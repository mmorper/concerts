/**
 * `media:publish-video` — the parts that decide what goes public.
 *
 * No ffmpeg and no bucket: MP4s are built by hand, and R2 and the CDN are recorded fakes. What
 * is pinned here is the gate. A wrong clip must not reach the site, a clip must not go live
 * unverified, and nothing goes public without being named.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { mediaId } from '../../src/components/ask/media'
import type { MediaAsset } from '../../scripts/media/media-index'
import { R2Host, hostConfigFromEnv, type HostConfig } from '../../scripts/syndication/host'
import {
  CACHE_FOREVER,
  WEB_SHORT_EDGE,
  checkWebEncode,
  clipFilename,
  corsMissing,
  findPosterLeaks,
  findVideoLeaks,
  isFaststart,
  objectKeys,
  posterArgs,
  posterTime,
  selectClips,
  topLevelAtoms,
  verifyHosted,
  versionedUrl,
  webEncodeArgs,
  type Probe,
} from '../../scripts/media/web-video'

function box(type: string, payload: Buffer = Buffer.alloc(4)): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + payload.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, payload])
}

const ftyp = box('ftyp')
const moov = box('moov', Buffer.alloc(16))
const mdat = box('mdat', Buffer.alloc(32))

const clip = (over: Partial<MediaAsset> = {}): MediaAsset =>
  ({
    kind: 'video',
    url: null,
    path: 'video/renders/2026-09-16-blancmange-01.mp4',
    date: '2026-09-16',
    artist: 'Blancmange',
    artistNormalized: 'blancmange',
    subject: 'artist',
    duration: 18,
    ...over,
  }) as MediaAsset

const goodProbe = (): Probe => ({
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      profile: 'High',
      pix_fmt: 'yuv420p',
      color_transfer: 'bt709',
      width: 720,
      height: 1280,
      tags: { language: 'und', handler_name: 'VideoHandler', encoder: 'Lavc libx264' },
    },
    { codec_type: 'audio', codec_name: 'aac', tags: { language: 'und', handler_name: 'SoundHandler' } },
  ],
  format: { tags: { major_brand: 'isom', minor_version: '512', compatible_brands: 'isomiso2avc1mp41' } },
})

describe('the ffmpeg recipe', () => {
  const args = webEncodeArgs('in.mp4', 'out.mp4')
  const after = (flag: string) => args[args.indexOf(flag) + 1]

  it('moves the index to the front, so playback needs no second fetch', () => {
    expect(after('-movflags')).toBe('+faststart')
  })

  it('drops every source tag, and stays repeatable so the URL does too', () => {
    expect(after('-map_metadata')).toBe('-1')
    expect(after('-fflags')).toBe('+bitexact')
  })

  it('tone maps to 8-bit SDR', () => {
    expect(after('-vf')).toContain('out_transfer=bt709')
    expect(after('-vf')).toContain('intent=perceptual')
    expect(after('-vf')).toContain('format=yuv420p')
    expect(after('-profile:v')).toBe('high')
  })

  it('never crops: the short edge is set and the other follows, either way up', () => {
    expect(after('-vf')).toContain(`'if(gt(iw,ih),-2,${WEB_SHORT_EDGE})':'if(gt(iw,ih),${WEB_SHORT_EDGE},-2)'`)
    expect(after('-vf')).not.toContain('crop=')
  })

  it('takes the first audio track only if there is one', () => {
    expect(args).toContain('0:a:0?')
  })

  it('cuts the poster from the web copy, at the moment asked for', () => {
    expect(posterArgs('web.mp4', 'p.jpg', 6)).toEqual(expect.arrayContaining(['-ss', '6', '-i', 'web.mp4']))
    expect(posterTime(18)).toBe(6)
    expect(posterTime(null)).toBe(0)
  })
})

describe('MP4 structure', () => {
  it('reads top-level boxes, including a 64-bit size', () => {
    const large = Buffer.alloc(16 + 8)
    large.writeUInt32BE(1, 0)
    large.write('mdat', 4, 'latin1')
    large.writeBigUInt64BE(BigInt(large.length), 8)
    expect(topLevelAtoms(Buffer.concat([ftyp, large])).map((a) => a.type)).toEqual(['ftyp', 'mdat'])
  })

  it('stops at a corrupt size rather than running off the end', () => {
    const bad = Buffer.alloc(8)
    bad.writeUInt32BE(9999, 0)
    bad.write('moov', 4, 'latin1')
    expect(topLevelAtoms(Buffer.concat([ftyp, bad])).map((a) => a.type)).toEqual(['ftyp'])
  })

  it('accepts moov ahead of mdat', () => {
    expect(isFaststart(Buffer.concat([ftyp, moov, mdat]))).toBe(true)
  })

  it('refuses moov at the end, which is how every render is written', () => {
    expect(isFaststart(Buffer.concat([ftyp, mdat, moov]))).toBe(false)
  })

  it('refuses a file with no moov at all', () => {
    expect(isFaststart(Buffer.concat([ftyp, mdat]))).toBe(false)
  })
})

describe('metadata leaks', () => {
  it('passes a clean file', () => {
    expect(findVideoLeaks(Buffer.concat([ftyp, moov, mdat]))).toEqual([])
  })

  it('finds a GPS location in moov', () => {
    const gps = box('moov', Buffer.concat([Buffer.from([0xa9, 0x78, 0x79, 0x7a]), Buffer.from('+55.86-004.25/')]))
    expect(findVideoLeaks(Buffer.concat([ftyp, gps, mdat])).join()).toContain('GPS')
  })

  it('finds the QuickTime keys an iPhone writes', () => {
    const qt = box('moov', Buffer.from('com.apple.quicktime.model'))
    expect(findVideoLeaks(Buffer.concat([ftyp, qt, mdat])).join()).toContain('QuickTime')
  })

  it('ignores a marker inside mdat, where it is only compressed noise', () => {
    const noise = box('mdat', Buffer.from([0xa9, 0x78, 0x79, 0x7a]))
    expect(findVideoLeaks(Buffer.concat([ftyp, moov, noise]))).toEqual([])
  })

  it('refuses bytes it cannot read as an MP4, rather than calling them clean', () => {
    expect(findVideoLeaks(Buffer.from('not an mp4'))).not.toEqual([])
  })

  it('finds EXIF in a poster', () => {
    expect(findPosterLeaks(Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.alloc(8)]))).not.toEqual([])
    expect(findPosterLeaks(Buffer.alloc(32))).toEqual([])
  })
})

describe('checkWebEncode', () => {
  it('passes the encode the recipe produces', () => {
    expect(checkWebEncode(goodProbe())).toEqual([])
  })

  it('passes a landscape clip and a silent one', () => {
    const p = goodProbe()
    Object.assign(p.streams[0], { width: 1280, height: 720 })
    p.streams.pop()
    expect(checkWebEncode(p)).toEqual([])
  })

  it.each([
    ['profile', 'High 10', /profile/],
    ['pix_fmt', 'yuv420p10le', /pixel format/],
    ['color_transfer', 'arib-std-b67', /transfer/],
    ['codec_name', 'hevc', /codec/],
    ['width', 1080, /short edge/],
  ])('refuses %s = %s', (field, value, message) => {
    const p = goodProbe()
    Object.assign(p.streams[0], { [field]: value })
    expect(checkWebEncode(p).join()).toMatch(message)
  })

  it('refuses capture time, and any tag it has never heard of', () => {
    const p = goodProbe()
    p.format.tags!.creation_time = '2026-09-16T21:04:00Z'
    p.streams[0].tags!.something_new = 'x'
    const problems = checkWebEncode(p).join()
    expect(problems).toContain('creation_time')
    expect(problems).toContain('something_new')
  })

  it('refuses the device handler a render carries', () => {
    const p = goodProbe()
    p.streams[0].tags!.handler_name = 'Core Media Video'
    expect(checkWebEncode(p).join()).toContain('handler_name')
  })

  it('refuses a file with no video', () => {
    expect(checkWebEncode({ streams: [], format: {} })).toEqual(['no video stream'])
  })
})

describe('where things are stored', () => {
  const name = '2026-09-16-thompson-twins-02.mp4'

  it('names objects as the index does', () => {
    expect(objectKeys(name)).toEqual({
      video: 'videos/2026-09-16-thompson-twins-02.mp4',
      poster: 'posters/2026-09-16-thompson-twins-02.jpg',
    })
  })

  it('versions by content', () => {
    const url = versionedUrl('https://media.example', 'videos/a.mp4', 'abcdef0123456789ff')
    expect(url).toBe('https://media.example/videos/a.mp4?v=abcdef012345')
  })

  it('keeps a share link stable when a clip is re-encoded', () => {
    const asId = (sha: string) =>
      mediaId({ kind: 'video', date: '2026-09-16', url: versionedUrl('https://m.example', objectKeys(name).video, sha) })
    expect(asId('aaaaaaaaaaaaaaaa')).toBe('thompson-twins-02-video')
    expect(asId('bbbbbbbbbbbbbbbb')).toBe('thompson-twins-02-video')
  })
})

describe('selectClips', () => {
  it('takes only video', () => {
    const still = clip({ kind: 'image', path: undefined })
    expect(selectClips([still, clip()], {}).ready).toHaveLength(1)
  })

  it('narrows by date and by clip', () => {
    const other = clip({ date: '2026-09-14', path: 'video/renders/2026-09-14-danny-elfman-01.mp4' })
    expect(selectClips([clip(), other], { date: '2026-09-14' }).ready).toEqual([other])
    expect(selectClips([clip(), other], { only: '2026-09-16-blancmange' }).ready).toEqual([clip()])
  })

  it('leaves a published clip alone unless forced', () => {
    const live = clip({ url: 'https://m.example/videos/a.mp4?v=1' })
    expect(selectClips([live], {}).ready).toEqual([])
    expect(selectClips([live], {}).held[0].reason).toBe('already published')
    expect(selectClips([live], { force: true }).ready).toEqual([live])
  })

  it('holds a clip with no act, and never defaults it to the headliner', () => {
    const { ready, held } = selectClips([clip({ artistNormalized: null })], {})
    expect(ready).toEqual([])
    expect(held[0].reason).toBe('no act credited')
  })

  it('allows a venue clip, which has no act by definition', () => {
    expect(selectClips([clip({ artistNormalized: null, subject: 'venue' })], {}).ready).toHaveLength(1)
  })

  it('reports a clip it cannot read, rather than dropping it', () => {
    expect(selectClips([clip({ path: null })], {}).held[0].reason).toContain('no render path')
  })

  it('reads the filename off the render path', () => {
    expect(clipFilename(clip())).toBe('2026-09-16-blancmange-01.mp4')
  })
})

/** A public bucket behind the CDN, serving these bytes. */
function fakeCdn(bytes: Buffer, over: { status?: number; contentType?: string; cache?: string; corrupt?: boolean; failFirst?: number } = {}) {
  let failures = over.failFirst ?? 0
  const calls: string[] = []
  const impl = (async (_url: URL | string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const range = headers.get('range')
    calls.push(`${init?.method ?? 'GET'} ${range ?? ''}`.trim())
    if (failures > 0) {
      failures--
      return new Response(null, { status: 404 })
    }
    const base = {
      'content-type': over.contentType ?? 'video/mp4',
      'cache-control': over.cache ?? CACHE_FOREVER,
    }
    if (init?.method === 'HEAD') {
      return new Response(null, {
        status: over.status ?? 200,
        headers: { ...base, 'content-length': String(bytes.length) },
      })
    }
    const m = /bytes=(\d+)-(\d+)/.exec(range ?? '')!
    const [start, end] = [Number(m[1]), Number(m[2])]
    const body = Buffer.from(bytes.subarray(start, end + 1))
    if (over.corrupt) body.fill(0)
    return new Response(new Uint8Array(body), {
      status: over.status ?? 206,
      headers: { ...base, 'content-range': `bytes ${start}-${end}/${bytes.length}` },
    })
  }) as typeof fetch
  return { impl, calls }
}

describe('the published index', () => {
  // The meta-injector leaves a clip without this out of its structured data, and says nothing.
  it('records when every published clip went up, and never the night it was filmed', () => {
    const { assets } = JSON.parse(readFileSync('public/data/media-index.json', 'utf-8')) as { assets: MediaAsset[] }
    const published = assets.filter((a) => a.kind === 'video' && a.url)
    expect(published.length).toBeGreaterThan(0)
    for (const clip of published) {
      expect(clip.uploadedAt, clip.url!).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(clip.uploadedAt!.startsWith(clip.date), clip.url!).toBe(false)
    }
  })
})

describe('verifyHosted', () => {
  const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251))
  const file = { url: 'https://m.example/videos/a.mp4?v=1', bytes, contentType: 'video/mp4' }
  const noWait = async () => {}

  it('passes when the head and the tail both come back byte for byte', async () => {
    const cdn = fakeCdn(bytes)
    expect(await verifyHosted(file, cdn.impl, noWait)).toEqual([])
    expect(cdn.calls).toEqual(['HEAD', 'GET bytes=0-1023', 'GET bytes=3976-4999'])
  })

  it('handles a file smaller than the sample', async () => {
    const small = Buffer.from('tiny')
    const cdn = fakeCdn(small, { contentType: 'image/jpeg' })
    expect(await verifyHosted({ ...file, bytes: small, contentType: 'image/jpeg' }, cdn.impl, noWait)).toEqual([])
  })

  it('fails a host that ignores Range', async () => {
    const cdn = fakeCdn(bytes)
    const noRange = (async (u: URL | string, init?: RequestInit) => {
      const res = await cdn.impl(u, init)
      return init?.method === 'HEAD' ? res : new Response(await res.arrayBuffer(), { status: 200, headers: res.headers })
    }) as typeof fetch
    expect((await verifyHosted(file, noRange, noWait, 1)).join()).toContain('returned 200')
  })

  it('fails a 206 carrying the wrong bytes', async () => {
    expect((await verifyHosted(file, fakeCdn(bytes, { corrupt: true }).impl, noWait, 1)).join()).toContain('wrong bytes')
  })

  it('fails a wrong content type or short cache', async () => {
    expect((await verifyHosted(file, fakeCdn(bytes, { contentType: 'text/plain' }).impl, noWait, 1)).join()).toContain('content-type')
    expect((await verifyHosted(file, fakeCdn(bytes, { cache: 'max-age=60' }).impl, noWait, 1)).join()).toContain('cache-control')
  })

  it('rides out a cold first read', async () => {
    expect(await verifyHosted(file, fakeCdn(bytes, { failFirst: 1 }).impl, noWait)).toEqual([])
  })

  it('gives up after its attempts and says why', async () => {
    const problems = await verifyHosted(file, fakeCdn(bytes, { failFirst: 9 }).impl, noWait, 2)
    expect(problems).toEqual(['HEAD returned 404'])
  })

  it('reports a network error rather than throwing it', async () => {
    const down = (async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }) as typeof fetch
    expect(await verifyHosted(file, down, noWait, 1)).toEqual(['getaddrinfo ENOTFOUND'])
  })
})

describe('corsMissing', () => {
  it('sees whether the bucket answers with an allow header', async () => {
    const allowed = (async () =>
      new Response(null, { status: 206, headers: { 'access-control-allow-origin': 'https://x' } })) as typeof fetch
    const silent = (async () => new Response(null, { status: 206 })) as typeof fetch
    expect(await corsMissing('https://m.example/a', allowed)).toBe(false)
    expect(await corsMissing('https://m.example/a', silent)).toBe(true)
  })
})

describe('R2Host.put', () => {
  const config: HostConfig = {
    accountId: 'acc',
    accessKeyId: 'AK',
    secretAccessKey: 'SK',
    bucket: 'concerts-media',
    publicUrl: 'https://m.example',
  }
  const now = () => new Date('2026-11-01T12:00:00Z')

  it('signs the cache header, so R2 stores what the CDN needs', async () => {
    let seen: { url: string; headers: Record<string, string>; bytes: number } | undefined
    const impl = (async (url: URL | string, init?: RequestInit) => {
      seen = {
        url: String(url),
        headers: init?.headers as Record<string, string>,
        bytes: (init?.body as Uint8Array).length,
      }
      return new Response(null, { status: 200 })
    }) as typeof fetch

    await new R2Host(config, impl, now).put('videos/a b.mp4', Buffer.alloc(10), 'video/mp4', CACHE_FOREVER)

    expect(seen?.url).toBe('https://acc.r2.cloudflarestorage.com/concerts-media/videos/a%20b.mp4')
    expect(seen?.bytes).toBe(10)
    expect(seen?.headers['cache-control']).toBe(CACHE_FOREVER)
    expect(seen?.headers['content-type']).toBe('video/mp4')
    expect(seen?.headers.Authorization).toContain('SignedHeaders=cache-control;content-type;host;')
  })

  it('throws on a refused upload, so a failed PUT can never be read as done', async () => {
    const impl = (async () => new Response('denied', { status: 403 })) as typeof fetch
    await expect(new R2Host(config, impl, now).put('k', Buffer.alloc(1), 'video/mp4')).rejects.toThrow(/403/)
  })
})

describe('hostConfigFromEnv', () => {
  const env = {
    R2_ACCOUNT_ID: 'card-account',
    R2_ACCESS_KEY_ID: 'card-key',
    R2_SECRET_ACCESS_KEY: 'card-secret',
    R2_BUCKET: 'concerts-syndication',
    R2_PUBLIC_URL: 'https://cards.example/',
  }
  const media = {
    R2_MEDIA_ACCOUNT_ID: 'acc',
    R2_MEDIA_ACCESS_KEY_ID: 'media-key',
    R2_MEDIA_SECRET_ACCESS_KEY: 'media-secret',
    R2_MEDIA_BUCKET: 'concerts-media',
    R2_MEDIA_PUBLIC_URL: 'https://media.example/',
  }

  it('keeps the two jobs on separate credentials', () => {
    expect(hostConfigFromEnv({ ...env, ...media } as NodeJS.ProcessEnv)?.bucket).toBe('concerts-syndication')
    expect(hostConfigFromEnv({ ...env, ...media } as NodeJS.ProcessEnv, 'R2_MEDIA')).toEqual({
      accountId: 'acc',
      accessKeyId: 'media-key',
      secretAccessKey: 'media-secret',
      bucket: 'concerts-media',
      publicUrl: 'https://media.example',
    })
  })

  it('never falls back to the card credentials', () => {
    expect(hostConfigFromEnv(env as unknown as NodeJS.ProcessEnv, 'R2_MEDIA')).toBeUndefined()
  })
})
