/**
 * RELEASE_DATE_CORRECTIONS — release dates MusicBrainz has wrong.
 *
 * Found by the 2026-09-10 fact-check: discography.json had Violator out on
 * 1990-02-05 (the "Enjoy the Silence" single) and Raising Hell on 1986-11-25.
 * Both dates flow into album-eras.json and song-albums.json, and from there into
 * every detector that compares a show date with a record — so a correction that
 * reaches one file and not the others is not a correction.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  RELEASE_DATE_CORRECTIONS,
  applyReleaseDateCorrections,
} from '../../scripts/enrich-discography'

const DATA = join(__dirname, '..', '..', 'public', 'data')
const read = (file: string) => JSON.parse(readFileSync(join(DATA, file), 'utf8'))

const VIOLATOR = '71f1482e-e63f-3b2c-811b-939f62708f2a'
const RAISING_HELL = 'a209c0a5-e9b2-37ff-a76d-df5bc405a0e8'

/** Every object anywhere in `value` that carries this release-group MBID. */
function carrying(value: unknown, mbid: string, out: Array<Record<string, unknown>> = []) {
  if (Array.isArray(value)) {
    for (const item of value) carrying(item, mbid, out)
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.mbid === mbid || record.id === mbid) out.push(record)
    for (const child of Object.values(record)) carrying(child, mbid, out)
  }
  return out
}

describe('applyReleaseDateCorrections', () => {
  it('corrects the date and year in place, cached entries included', () => {
    const discography = {
      'depeche-mode': { albums: [{ id: VIOLATOR, title: 'Violator', releaseDate: '1990-02-05', year: 1990 }] },
    }
    const result = applyReleaseDateCorrections(discography)

    expect(discography['depeche-mode'].albums[0]).toMatchObject({ releaseDate: '1990-03-19', year: 1990 })
    expect(result.applied).toEqual(['depeche-mode: Violator → 1990-03-19'])
    // Not in this fixture, so it is reported rather than silently ignored.
    expect(result.missing).toEqual([RAISING_HELL])
  })

  it('reports nothing when the date is already right', () => {
    const discography = {
      'depeche-mode': { albums: [{ id: VIOLATOR, title: 'Violator', releaseDate: '1990-03-19', year: 1990 }] },
    }
    expect(applyReleaseDateCorrections(discography).applied).toEqual([])
  })
})

describe('RELEASE_DATE_CORRECTIONS vs. the published data', () => {
  it('names only albums that exist, under the artist and title it says', () => {
    const discography = read('discography.json')
    for (const [mbid, fix] of Object.entries(RELEASE_DATE_CORRECTIONS)) {
      const album = discography[fix.artist]?.albums?.find((a: { id: string }) => a.id === mbid)
      expect(album?.title, `${fix.artist} ${mbid}`).toBe(fix.title)
    }
  })

  it('every published file carries the corrected date', () => {
    for (const file of ['discography.json', 'album-eras.json', 'song-albums.json']) {
      const data = read(file)
      for (const [mbid, fix] of Object.entries(RELEASE_DATE_CORRECTIONS)) {
        for (const record of carrying(data, mbid)) {
          expect(record.releaseDate, `${file}: ${fix.title}`).toBe(fix.releaseDate)
        }
      }
    }
  })
})
