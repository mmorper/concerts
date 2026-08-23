/**
 * Read just enough EXIF to cross-check a file, and prove that none of it survived.
 *
 * TWO JOBS, AND THEY PULL IN OPPOSITE DIRECTIONS:
 *
 * 1. `readExifSummary` reads the SOURCE. Capture time is used only as a cross-check
 *    against the folder the file was filed under. It is never the source of truth:
 *    derived files routinely lose `DateTimeOriginal` — ffmpeg strips it outright, and
 *    Photos exports of edited files are inconsistent. A missing date is normal and says
 *    nothing. A contradicting date is worth a warning, and the folder still wins.
 *
 * 2. `findMetadataLeaks` reads the OUTPUT and must find nothing. Personal media never
 *    reaches the repo carrying GPS, capture time or a device identifier. That is asserted
 *    rather than trusted — and asserted twice, by two mechanisms that do not share a
 *    parser, because "the library says it stripped it" is exactly the kind of claim this
 *    project has been burned by.
 *
 * No dependency: the parser below is ~80 lines and reads four tags. Adding a package to
 * read four tags, in the one place where being wrong means leaking someone's home address,
 * is a worse trade than owning the code.
 *
 * @module scripts/media/exif
 */

/** The APP1 payload sharp hands back starts with this, then a TIFF header. */
const EXIF_PREFIX = Buffer.from('Exif\0\0', 'latin1')

const TAG_MAKE = 0x010f
const TAG_MODEL = 0x0110
const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_DATE_TIME_DIGITIZED = 0x9004
const TAG_DATE_TIME = 0x0132

export interface ExifSummary {
  /** "YYYY:MM:DD HH:MM:SS" as EXIF stores it, or null when absent — which is normal. */
  dateTimeOriginal: string | null
  make: string | null
  model: string | null
  hasGps: boolean
}

export const EMPTY_EXIF: ExifSummary = {
  dateTimeOriginal: null,
  make: null,
  model: null,
  hasGps: false,
}

interface Reader {
  buf: Buffer
  little: boolean
  /** Offsets in an EXIF IFD are relative to the start of the TIFF header, not the file. */
  tiff: number
}

const u16 = (r: Reader, at: number) => (r.little ? r.buf.readUInt16LE(at) : r.buf.readUInt16BE(at))
const u32 = (r: Reader, at: number) => (r.little ? r.buf.readUInt32LE(at) : r.buf.readUInt32BE(at))

/** Walk one IFD, handing each (tag, type, count, valueOffset) to `visit`. */
function walkIfd(r: Reader, ifdOffset: number, visit: (tag: number, type: number, count: number, at: number) => void): void {
  const base = r.tiff + ifdOffset
  if (base + 2 > r.buf.length) return
  const entries = u16(r, base)
  // A corrupt or misread header can claim an absurd entry count; 512 is far past any real
  // IFD and stops a bad read from walking the whole buffer.
  if (entries > 512) return
  for (let i = 0; i < entries; i++) {
    const at = base + 2 + i * 12
    if (at + 12 > r.buf.length) return
    visit(u16(r, at), u16(r, at + 2), u32(r, at + 4), at + 8)
  }
}

/** ASCII values longer than 4 bytes live at an offset; shorter ones sit inline. */
function ascii(r: Reader, count: number, at: number): string | null {
  const start = count > 4 ? r.tiff + u32(r, at) : at
  if (start < 0 || start + count > r.buf.length) return null
  return r.buf.subarray(start, start + count).toString('latin1').replace(/\0.*$/, '').trim() || null
}

/**
 * Parse an EXIF block. Returns EMPTY_EXIF for anything unparseable.
 *
 * Deliberately forgiving: this feeds a WARNING, and a malformed header must never be the
 * reason a photograph fails to ingest.
 */
export function readExifSummary(exif: Buffer | undefined | null): ExifSummary {
  if (!exif || exif.length < 8) return EMPTY_EXIF
  try {
    let buf = exif
    if (buf.subarray(0, 6).equals(EXIF_PREFIX)) buf = buf.subarray(6)
    const order = buf.subarray(0, 2).toString('latin1')
    if (order !== 'II' && order !== 'MM') return EMPTY_EXIF
    const r: Reader = { buf, little: order === 'II', tiff: 0 }
    if (u16(r, 2) !== 42) return EMPTY_EXIF

    const out: ExifSummary = { ...EMPTY_EXIF }
    let exifIfd = 0
    let fallbackDate: string | null = null

    walkIfd(r, u32(r, 4), (tag, type, count, at) => {
      if (tag === TAG_MAKE && type === 2) out.make = ascii(r, count, at)
      else if (tag === TAG_MODEL && type === 2) out.model = ascii(r, count, at)
      else if (tag === TAG_EXIF_IFD) exifIfd = u32(r, at)
      else if (tag === TAG_GPS_IFD) out.hasGps = u32(r, at) > 0
      else if (tag === TAG_DATE_TIME && type === 2) fallbackDate = ascii(r, count, at)
    })

    if (exifIfd > 0) {
      walkIfd(r, exifIfd, (tag, type, count, at) => {
        if (type !== 2) return
        if (tag === TAG_DATE_TIME_ORIGINAL) out.dateTimeOriginal = ascii(r, count, at)
        else if (tag === TAG_DATE_TIME_DIGITIZED && !fallbackDate) fallbackDate = ascii(r, count, at)
      })
    }
    // DateTimeOriginal is the real capture moment; DateTime/DateTimeDigitized are a last
    // resort and are often a file-modification time, so they are only used when nothing
    // better exists and they still only ever produce a warning.
    out.dateTimeOriginal ??= fallbackDate
    return out
  } catch {
    return EMPTY_EXIF
  }
}

/** "2018:04:27 20:15:33" -> "2018-04-27". Null when the string is not an EXIF datetime. */
export function exifDateToIso(value: string | null): string | null {
  if (!value) return null
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(value.trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/**
 * Byte-level markers for metadata that must never reach the repo.
 *
 * Scanned over the raw output as a SECOND, independent check. The first check asks sharp
 * whether it stripped the metadata, and sharp is also what did the stripping — a single
 * check would be the encoder marking its own homework.
 */
const LEAK_MARKERS: Array<{ label: string; bytes: Buffer }> = [
  { label: 'EXIF block (APP1)', bytes: EXIF_PREFIX },
  { label: 'XMP packet', bytes: Buffer.from('http://ns.adobe.com/xap/1.0/', 'latin1') },
  { label: 'XMP metadata', bytes: Buffer.from('<x:xmpmeta', 'latin1') },
  { label: 'Photoshop/IPTC block', bytes: Buffer.from('Photoshop 3.0', 'latin1') },
  { label: 'GPS tag name', bytes: Buffer.from('GPSLatitude', 'latin1') },
]

/**
 * Everything that must not be in a committed file. Empty means clean.
 *
 * `sharpMeta` is what sharp reports about the OUTPUT; `bytes` is the output itself.
 */
export function findMetadataLeaks(
  bytes: Buffer,
  sharpMeta: { exif?: unknown; xmp?: unknown; iptc?: unknown }
): string[] {
  const leaks: string[] = []
  if (sharpMeta.exif) leaks.push('sharp reports an EXIF block on the output')
  if (sharpMeta.xmp) leaks.push('sharp reports an XMP block on the output')
  if (sharpMeta.iptc) leaks.push('sharp reports an IPTC block on the output')
  for (const marker of LEAK_MARKERS) {
    if (bytes.includes(marker.bytes)) leaks.push(`raw bytes contain a ${marker.label}`)
  }
  return leaks
}
