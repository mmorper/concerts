import { describe, it, expect } from 'vitest'
import { isPhoneViewport } from '../../src/hooks/useGatefoldOrientation'

describe('which viewports get the phone layout', () => {
  it('sends a phone held upright to the phone layout', () => {
    expect(isPhoneViewport(390, 844)).toBe(true)
  })

  it('sends a phone held sideways there too, where the gatefold would run off the screen', () => {
    expect(isPhoneViewport(844, 390)).toBe(true)
  })

  it('keeps the gatefold for a tablet and a laptop', () => {
    expect(isPhoneViewport(768, 1024)).toBe(false)
    expect(isPhoneViewport(1024, 768)).toBe(false)
    expect(isPhoneViewport(1280, 800)).toBe(false)
  })
})
