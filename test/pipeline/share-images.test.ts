import { describe, it, expect } from 'vitest'
import { cropRegion } from '../../scripts/media/share-images'

describe('share image crop', () => {
  it('turns the owner’s crop into pixels', () => {
    expect(cropRegion({ x: 0, y: 0.0625, w: 1, h: 0.9375 }, 1536, 2048)).toEqual({ left: 0, top: 128, width: 1536, height: 1920 })
  })

  it('uses the whole frame when there is no crop', () => {
    expect(cropRegion(null, 1536, 2048)).toEqual({ left: 0, top: 0, width: 1536, height: 2048 })
  })

  it('never reaches outside the image, which sharp refuses', () => {
    const r = cropRegion({ x: 0.5, y: 0.5, w: 0.6, h: 0.6 }, 1000, 1000)
    expect(r.left + r.width).toBeLessThanOrEqual(1000)
    expect(r.top + r.height).toBeLessThanOrEqual(1000)
  })
})
