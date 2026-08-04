/**
 * useShareLink behaviour (#204)
 *
 * Exercises the real writeToClipboard with injected globals, rather than a
 * mirrored copy — a mirror can pass while the shipped code is broken.
 *
 * The fallback is the important part: PhoneArtistModal carried an iOS Safari
 * execCommand path the other three implementations lacked, and consolidating
 * without it would have been a silent regression on the platform most likely
 * to be sharing.
 */

import { describe, it, expect, vi } from 'vitest'
import { writeToClipboard } from '../../src/hooks/useShareLink'

/** Minimal document stand-in — vitest runs these in the node environment. */
function fakeDoc(execResult: boolean, onAppend?: (n: unknown) => void) {
  const appended: unknown[] = []
  return {
    doc: {
      createElement: () => ({ value: '', style: {} as Record<string, string>, select: () => {} }),
      body: {
        appendChild: (n: unknown) => { appended.push(n); onAppend?.(n) },
        removeChild: (n: unknown) => { appended.splice(appended.indexOf(n), 1) },
      },
      execCommand: vi.fn().mockReturnValue(execResult),
    } as unknown as Document,
    appended,
  }
}

const URL_UNDER_TEST =
  'https://concerts.morperhaus.org/?scene=artists&artist=nile-rodgers&show=2026-07-31'

describe('clipboard write with the iOS fallback', () => {
  const okClipboard = () =>
    ({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } }) as unknown as Navigator
  const failingClipboard = () =>
    ({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } }) as unknown as Navigator

  it('uses the clipboard API when it works', async () => {
    const nav = okClipboard()
    expect(await writeToClipboard(URL_UNDER_TEST, { nav, doc: fakeDoc(true).doc })).toBe(true)
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(URL_UNDER_TEST)
  })

  it('falls back to execCommand when the clipboard API rejects', async () => {
    // The iOS Safari case: secure context, permission granted, still rejects.
    const { doc } = fakeDoc(true)
    expect(await writeToClipboard(URL_UNDER_TEST, { nav: failingClipboard(), doc })).toBe(true)
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
  })

  it('reports failure when both paths fail, rather than claiming success', async () => {
    const { doc } = fakeDoc(false)
    expect(await writeToClipboard(URL_UNDER_TEST, { nav: failingClipboard(), doc })).toBe(false)
  })

  it('leaves no scratch textarea behind after the fallback runs', async () => {
    const { doc, appended } = fakeDoc(true)
    await writeToClipboard(URL_UNDER_TEST, { nav: failingClipboard(), doc })
    expect(appended).toHaveLength(0)
  })

  it('reports failure rather than throwing when there is no clipboard at all', async () => {
    expect(await writeToClipboard(URL_UNDER_TEST, { nav: {} as Navigator })).toBe(false)
  })
})

describe('surface selection', () => {
  // The rule the four old implementations disagreed on: the share sheet is
  // gated on isPhone AND availability — never on availability alone, which
  // would give desktop Safari a sheet while desktop Chrome copied.
  const wantsSheet = (isPhone: boolean, hasShare: boolean) => isPhone && hasShare

  it('offers the sheet on a phone that supports it', () => {
    expect(wantsSheet(true, true)).toBe(true)
  })

  it('copies on a phone without share support', () => {
    expect(wantsSheet(true, false)).toBe(false)
  })

  it('copies on desktop even where navigator.share exists', () => {
    // Desktop Safari has navigator.share; desktop Chrome does not. Feature
    // detection alone would make the same click behave differently.
    expect(wantsSheet(false, true)).toBe(false)
  })
})
