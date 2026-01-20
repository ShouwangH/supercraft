import { describe, it, expect } from 'vitest'
import { checkScale, detectUnits } from '@/lib/analysis/scale'
import type { BBox } from '@/types/mesh'

// Helper to create a bounding box
function createBBox(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): BBox {
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    dimensions: [maxX - minX, maxY - minY, maxZ - minZ],
  }
}

describe('scale', () => {
  describe('checkScale', () => {
    it('returns reasonable for typical model (50mm)', () => {
      const bbox = createBBox(0, 0, 0, 50, 50, 50)
      const result = checkScale(bbox)

      expect(result.isReasonable).toBe(true)
      expect(result.warning).toBeNull()
      expect(result.severity).toBe('none')
      expect(result.maxDimensionMm).toBe(50)
    })

    it('returns error for very small model (< 5mm)', () => {
      const bbox = createBBox(0, 0, 0, 2, 2, 2)
      const result = checkScale(bbox)

      expect(result.isReasonable).toBe(false)
      expect(result.warning).toContain('very small')
      expect(result.severity).toBe('error')
      expect(result.suggestedScaleFactor).toBeGreaterThan(1)
    })

    it('returns error for very large model (> 2000mm)', () => {
      const bbox = createBBox(0, 0, 0, 3000, 3000, 3000)
      const result = checkScale(bbox)

      expect(result.isReasonable).toBe(false)
      expect(result.warning).toContain('very large')
      expect(result.severity).toBe('error')
      expect(result.suggestedScaleFactor).toBeLessThan(1)
    })

    it('returns warning for small model (5-10mm)', () => {
      const bbox = createBBox(0, 0, 0, 7, 7, 7)
      const result = checkScale(bbox)

      expect(result.isReasonable).toBe(true)
      expect(result.warning).toContain('small')
      expect(result.severity).toBe('warning')
    })

    it('returns warning for large model (300-2000mm)', () => {
      const bbox = createBBox(0, 0, 0, 500, 500, 500)
      const result = checkScale(bbox)

      expect(result.isReasonable).toBe(true)
      expect(result.warning).toContain('large')
      expect(result.severity).toBe('warning')
    })

    it('returns error for zero-dimension model', () => {
      const bbox = createBBox(0, 0, 0, 0, 0, 0)
      const result = checkScale(bbox)

      expect(result.isReasonable).toBe(false)
      expect(result.warning).toContain('zero dimensions')
      expect(result.severity).toBe('error')
    })

    it('uses max dimension for checks', () => {
      // Long thin model: 5x5x500mm
      const bbox = createBBox(0, 0, 0, 5, 5, 500)
      const result = checkScale(bbox)

      expect(result.maxDimensionMm).toBe(500)
      expect(result.minDimensionMm).toBe(5)
    })

    it('applies unit scale', () => {
      // Model in meters (0.05m = 50mm)
      const bbox = createBBox(0, 0, 0, 0.05, 0.05, 0.05)
      const result = checkScale(bbox, { unitScale: 1000 })

      expect(result.maxDimensionMm).toBe(50)
      expect(result.isReasonable).toBe(true)
    })

    it('respects custom thresholds', () => {
      const bbox = createBBox(0, 0, 0, 100, 100, 100)
      const result = checkScale(bbox, {
        minDimensionMm: 50,
        maxDimensionMm: 150,
      })

      expect(result.isReasonable).toBe(true)
    })

    it('suggestedScaleFactor is 1 when no change needed', () => {
      const bbox = createBBox(0, 0, 0, 50, 50, 50)
      const result = checkScale(bbox)

      expect(result.suggestedScaleFactor).toBe(1)
    })
  })

  describe('detectUnits', () => {
    it('detects mm for typical model dimensions', () => {
      const bbox = createBBox(0, 0, 0, 100, 100, 100)
      const result = detectUnits(bbox)

      expect(result.unit).toBe('mm')
      expect(result.scaleFactor).toBe(1)
    })

    it('detects meters for very small dimensions', () => {
      // 0.1m model = 100mm
      const bbox = createBBox(0, 0, 0, 0.1, 0.1, 0.1)
      const result = detectUnits(bbox)

      expect(result.unit).toBe('meters')
      expect(result.scaleFactor).toBe(1000)
    })

    it('considers inches for medium dimensions', () => {
      // 2 inches = ~50mm, which is reasonable
      const bbox = createBBox(0, 0, 0, 2, 2, 2)
      const result = detectUnits(bbox)

      // Could be detected as mm or inches depending on heuristic
      expect(['mm', 'inches']).toContain(result.unit)
    })

    it('returns mm as default for large values', () => {
      const bbox = createBBox(0, 0, 0, 5000, 5000, 5000)
      const result = detectUnits(bbox)

      expect(result.unit).toBe('mm')
    })
  })
})
