import { describe, it, expect } from 'vitest'
import { checkWatertight, checkWatertightFromIndices } from '@/lib/analysis/watertight'
import { buildEdgeMap } from '@/lib/analysis/edgeMap'

// Helper: Create a closed cube (12 triangles)
function createClosedCubeIndices(): Uint32Array {
  return new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom
    4, 5, 6, 4, 6, 7, // Top
    3, 6, 2, 3, 7, 6, // Front
    0, 1, 5, 0, 5, 4, // Back
    0, 4, 7, 0, 7, 3, // Left
    1, 2, 6, 1, 6, 5, // Right
  ])
}

// Helper: Create an open box (10 triangles - missing top)
function createOpenBoxIndices(): Uint32Array {
  return new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom
    3, 6, 2, 3, 7, 6, // Front
    0, 1, 5, 0, 5, 4, // Back
    0, 4, 7, 0, 7, 3, // Left
    1, 2, 6, 1, 6, 5, // Right
    // Top OMITTED
  ])
}

// Helper: Create a single triangle
function createSingleTriangleIndices(): Uint32Array {
  return new Uint32Array([0, 1, 2])
}

describe('watertight', () => {
  describe('checkWatertight', () => {
    it('returns watertight=true for closed cube', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkWatertight(edgeMap)

      expect(result.isWatertight).toBe(true)
      expect(result.boundaryEdgeCount).toBe(0)
      expect(result.boundaryEdges).toHaveLength(0)
    })

    it('returns watertight=false for open box with 4 boundary edges', () => {
      const indices = createOpenBoxIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkWatertight(edgeMap)

      expect(result.isWatertight).toBe(false)
      expect(result.boundaryEdgeCount).toBe(4)
      expect(result.boundaryEdges).toHaveLength(8) // 4 edges × 2 vertices each
    })

    it('returns watertight=false for single triangle with 3 boundary edges', () => {
      const indices = createSingleTriangleIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkWatertight(edgeMap)

      expect(result.isWatertight).toBe(false)
      expect(result.boundaryEdgeCount).toBe(3)
      expect(result.boundaryEdges).toHaveLength(6) // 3 edges × 2 vertices each
    })

    it('boundaryEdges array has even length', () => {
      const indices = createOpenBoxIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkWatertight(edgeMap)

      expect(result.boundaryEdges.length % 2).toBe(0)
    })
  })

  describe('checkWatertightFromIndices', () => {
    it('convenience function produces same result', () => {
      const indices = createOpenBoxIndices()

      const edgeMap = buildEdgeMap(indices)
      const result1 = checkWatertight(edgeMap)
      const result2 = checkWatertightFromIndices(indices)

      expect(result1.isWatertight).toBe(result2.isWatertight)
      expect(result1.boundaryEdgeCount).toBe(result2.boundaryEdgeCount)
    })

    it('handles empty indices', () => {
      const indices = new Uint32Array([])
      const result = checkWatertightFromIndices(indices)

      expect(result.isWatertight).toBe(true)
      expect(result.boundaryEdgeCount).toBe(0)
    })
  })

  describe('boundary edge vertex pairs', () => {
    it('contains valid vertex indices', () => {
      const indices = createOpenBoxIndices()
      const result = checkWatertightFromIndices(indices)

      // All boundary edge vertices should be valid indices (0-7 for cube)
      for (const vertex of result.boundaryEdges) {
        expect(vertex).toBeGreaterThanOrEqual(0)
        expect(vertex).toBeLessThanOrEqual(7)
      }
    })
  })
})
