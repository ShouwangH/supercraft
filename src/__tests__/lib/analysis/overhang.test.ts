import { describe, it, expect } from 'vitest'
import { analyzeOverhang, getOverhangHeat } from '@/lib/analysis/overhang'

// Helper: Create positions for a horizontal triangle facing up (XZ plane, Y=0)
// CCW winding when viewed from above (+Y direction)
function createUpFacingTriangle(): { positions: Float32Array; indices: Uint32Array } {
  return {
    positions: new Float32Array([
      0, 0, 0, // v0
      0, 0, 1, // v1
      1, 0, 0, // v2
    ]),
    indices: new Uint32Array([0, 1, 2]),
  }
}

// Helper: Create positions for a horizontal triangle facing down (XZ plane, normal pointing -Y)
// CCW winding when viewed from below (-Y direction)
function createDownFacingTriangle(): { positions: Float32Array; indices: Uint32Array } {
  return {
    positions: new Float32Array([
      0, 0, 0, // v0
      1, 0, 0, // v1
      0, 0, 1, // v2
    ]),
    indices: new Uint32Array([0, 1, 2]),
  }
}

// Helper: Create positions for a vertical triangle (XY plane, normal pointing +Z)
function createVerticalTriangle(): { positions: Float32Array; indices: Uint32Array } {
  return {
    positions: new Float32Array([
      0, 0, 0, // v0
      1, 0, 0, // v1
      0, 1, 0, // v2
    ]),
    indices: new Uint32Array([0, 1, 2]),
  }
}

// Helper: Create a 45-degree angled triangle
function create45DegreeTriangle(): { positions: Float32Array; indices: Uint32Array } {
  // Triangle tilted 45 degrees - normal at 45° from up vector
  // For a face at 45° from vertical, the normal is at 45° from the up axis
  return {
    positions: new Float32Array([
      0, 0, 0, // v0
      1, 0, 0, // v1
      0.5, 0.5, 0.707, // v2 - creates ~45° normal from up
    ]),
    indices: new Uint32Array([0, 1, 2]),
  }
}

// Helper: Create cube with all 12 triangles
function createCube(): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array([
    // Bottom face (y = 0)
    0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
    // Top face (y = 1)
    0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1,
  ])
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom (facing down - overhang)
    4, 5, 6, 4, 6, 7, // Top (facing up - no overhang)
    3, 6, 2, 3, 7, 6, // Front (facing +Z - 90° from up)
    0, 1, 5, 0, 5, 4, // Back (facing -Z - 90° from up)
    0, 4, 7, 0, 7, 3, // Left (facing -X - 90° from up)
    1, 2, 6, 1, 6, 5, // Right (facing +X - 90° from up)
  ])
  return { positions, indices }
}

describe('overhang', () => {
  describe('analyzeOverhang', () => {
    it('up-facing triangle has 0° angle (no overhang)', () => {
      const { positions, indices } = createUpFacingTriangle()
      const result = analyzeOverhang(positions, indices, 45)

      expect(result.faceAngles[0]).toBeCloseTo(0, 1)
      expect(result.overhangFaceCount).toBe(0)
      expect(result.overhangFaceMask[0]).toBe(0)
    })

    it('down-facing triangle has 180° angle (maximum overhang)', () => {
      const { positions, indices } = createDownFacingTriangle()
      const result = analyzeOverhang(positions, indices, 45)

      expect(result.faceAngles[0]).toBeCloseTo(180, 1)
      expect(result.overhangFaceCount).toBe(1)
      expect(result.overhangFaceMask[0]).toBe(1)
    })

    it('vertical triangle has 90° angle', () => {
      const { positions, indices } = createVerticalTriangle()
      const result = analyzeOverhang(positions, indices, 45)

      expect(result.faceAngles[0]).toBeCloseTo(90, 1)
      // At 45° threshold, 90° is NOT overhang (90 < 90+45=135)
      expect(result.overhangFaceMask[0]).toBe(0)
    })

    it('angled triangle reports valid angle', () => {
      const { positions, indices } = create45DegreeTriangle()
      const result = analyzeOverhang(positions, indices, 45)

      // Angle should be between 0 and 180
      expect(result.faceAngles[0]).toBeGreaterThanOrEqual(0)
      expect(result.faceAngles[0]).toBeLessThanOrEqual(180)
    })

    it('cube has correct mix of overhanging and non-overhanging faces', () => {
      const { positions, indices } = createCube()
      const result = analyzeOverhang(positions, indices, 45)

      // 12 faces total
      expect(result.faceAngles.length).toBe(12)
      expect(result.overhangFaceMask.length).toBe(12)

      // Top faces (2) should have 0° angle
      // Bottom faces (2) should have 180° angle (overhang)
      // Side faces (8) should have 90° angle

      // At 45° threshold, only bottom faces (angle > 135°) are overhang
      expect(result.overhangFaceCount).toBe(2)
    })

    it('overhang percentage is in [0, 100]', () => {
      const { positions, indices } = createCube()
      const result = analyzeOverhang(positions, indices, 45)

      expect(result.overhangPercentage).toBeGreaterThanOrEqual(0)
      expect(result.overhangPercentage).toBeLessThanOrEqual(100)
    })

    it('face mask length equals face count', () => {
      const { positions, indices } = createCube()
      const result = analyzeOverhang(positions, indices, 45)

      const faceCount = indices.length / 3
      expect(result.overhangFaceMask.length).toBe(faceCount)
      expect(result.faceAngles.length).toBe(faceCount)
    })

    it('handles custom up vector', () => {
      const { positions, indices } = createVerticalTriangle()

      // With default up [0,1,0], vertical triangle is 90°
      const result1 = analyzeOverhang(positions, indices, 45, [0, 1, 0])
      expect(result1.faceAngles[0]).toBeCloseTo(90, 1)

      // With up [0,0,1], same triangle points directly at up (0°)
      const result2 = analyzeOverhang(positions, indices, 45, [0, 0, 1])
      expect(result2.faceAngles[0]).toBeCloseTo(0, 1)
    })

    it('handles empty mesh', () => {
      const result = analyzeOverhang(new Float32Array([]), new Uint32Array([]), 45)

      expect(result.overhangFaceCount).toBe(0)
      expect(result.overhangPercentage).toBe(0)
      expect(result.maxOverhangAngle).toBe(0)
    })

    it('maxOverhangAngle tracks highest angle', () => {
      const { positions, indices } = createCube()
      const result = analyzeOverhang(positions, indices, 45)

      // Bottom faces have 180° angle
      expect(result.maxOverhangAngle).toBeCloseTo(180, 1)
    })
  })

  describe('getOverhangHeat', () => {
    it('returns 0 for angles below threshold', () => {
      expect(getOverhangHeat(0, 45)).toBe(0)
      expect(getOverhangHeat(90, 45)).toBe(0)
      expect(getOverhangHeat(135, 45)).toBe(0)
    })

    it('returns > 0 for angles above threshold', () => {
      expect(getOverhangHeat(136, 45)).toBeGreaterThan(0)
      expect(getOverhangHeat(160, 45)).toBeGreaterThan(0)
    })

    it('returns 1 for 180° angle', () => {
      expect(getOverhangHeat(180, 45)).toBeCloseTo(1, 5)
    })

    it('interpolates linearly between threshold and 180°', () => {
      // At 45° threshold, overhang starts at 135°
      // Midpoint between 135° and 180° is 157.5°
      const midHeat = getOverhangHeat(157.5, 45)
      expect(midHeat).toBeCloseTo(0.5, 1)
    })

    it('heat values are in [0, 1]', () => {
      for (let angle = 0; angle <= 180; angle += 10) {
        const heat = getOverhangHeat(angle, 45)
        expect(heat).toBeGreaterThanOrEqual(0)
        expect(heat).toBeLessThanOrEqual(1)
      }
    })
  })
})
