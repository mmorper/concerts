import { describe, it, expect, vi } from 'vitest'
import { safeFlyTo } from '../../src/utils/safeFlyTo'

function fakeMap(x: number, y: number) {
  return { getSize: () => ({ x, y }), flyTo: vi.fn(), setView: vi.fn() }
}

describe('flying a map that may have no size', () => {
  it('animates a map with a size, as flyTo always did', () => {
    const map = fakeMap(1200, 800)

    safeFlyTo(map as never, [33.8, -118], 9, { duration: 1.5 })

    expect(map.flyTo).toHaveBeenCalledWith([33.8, -118], 9, { duration: 1.5 })
    expect(map.setView).not.toHaveBeenCalled()
  })

  it('skips the animation at 0x0 and still lands on the same centre and zoom', () => {
    const map = fakeMap(0, 0)

    safeFlyTo(map as never, [33.8, -118], 9, { duration: 1.5 })

    expect(map.setView).toHaveBeenCalledWith([33.8, -118], 9, { animate: false })
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it('treats a map with one zero side as having no size', () => {
    const wide = fakeMap(1200, 0)
    const tall = fakeMap(0, 800)

    safeFlyTo(wide as never, [0, 0], 4)
    safeFlyTo(tall as never, [0, 0], 4)

    expect(wide.flyTo).not.toHaveBeenCalled()
    expect(tall.flyTo).not.toHaveBeenCalled()
  })
})
