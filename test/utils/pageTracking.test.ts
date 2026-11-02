/**
 * The pageview a deep link reports.
 *
 * It has to name the same URL the visitor arrived on. A `photo` that dropped out here left every
 * shared frame reporting as its night, with no way to tell which frame people came to see.
 */

import { describe, it, expect } from 'vitest'
import { buildPagePath } from '../../src/utils/pageTracking'
import { photoDeepLink, setlistDeepLink } from '../../src/utils/deepLinks'

const ARTISTS_SCENE = 5
const artist = 'thompson-twins'
const show = '2026-09-16'
const photo = 'thompson-twins-10'

describe('buildPagePath', () => {
  it('reports a shared frame as the URL that was shared', () => {
    expect(buildPagePath(ARTISTS_SCENE, { artist, show, photo })).toBe(photoDeepLink(artist, show, photo))
  })

  it('reports a night with no frame as the night', () => {
    expect(buildPagePath(ARTISTS_SCENE, { artist, show, photo: null })).toBe(setlistDeepLink(artist, show))
  })

  it('drops a frame whose show did not resolve', () => {
    expect(buildPagePath(ARTISTS_SCENE, { artist, show: null, photo })).not.toContain('photo=')
  })
})
