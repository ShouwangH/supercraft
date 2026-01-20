import { describe, it, expect } from 'vitest'
import { checkNonManifold, checkNonManifoldFromIndices } from '@/lib/analysis/nonManifold'
import { buildEdgeMap } from '@/lib/analysis/edgeMap'

// Helper: Create a closed cube (manifold)
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

// Helper: Create non-manifold mesh (3 triangles sharing one edge)
function createNonManifoldIndices(): Uint32Array {
  return new Uint32Array([
    0, 1, 2, // Triangle 1
    0, 1, 3, // Triangle 2 shares edge 0-1
    0, 1, 4, // Triangle 3 shares edge 0-1 (non-manifold!)
  ])
}

// Helper: Create T-junction geometry
// Four triangles all sharing edge 0-1 = non-manifold
function createTJunctionIndices(): Uint32Array {
  return new Uint32Array([
    0, 1, 2, // Triangle 1 uses edge 0-1
    0, 1, 3, // Triangle 2 uses edge 0-1
    0, 1, 4, // Triangle 3 uses edge 0-1
    0, 1, 5, // Triangle 4 uses edge 0-1 (4 faces on one edge!)
  ])
}

describe('nonManifold', () => {
  describe('checkNonManifold', () => {
    it('returns hasNonManifold=false for closed cube', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkNonManifold(edgeMap)

      expect(result.hasNonManifold).toBe(false)
      expect(result.nonManifoldEdgeCount).toBe(0)
      expect(result.nonManifoldEdges).toHaveLength(0)
    })

    it('returns hasNonManifold=true for 3 triangles sharing one edge', () => {
      const indices = createNonManifoldIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkNonManifold(edgeMap)

      expect(result.hasNonManifold).toBe(true)
      expect(result.nonManifoldEdgeCount).toBe(1)
      expect(result.nonManifoldEdges).toHaveLength(2) // 1 edge × 2 vertices
    })

    it('detects T-junction non-manifold edges', () => {
      const indices = createTJunctionIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkNonManifold(edgeMap)

      expect(result.hasNonManifold).toBe(true)
      expect(result.nonManifoldEdgeCount).toBeGreaterThan(0)
    })

    it('nonManifoldEdges array has even length', () => {
      const indices = createNonManifoldIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkNonManifold(edgeMap)

      expect(result.nonManifoldEdges.length % 2).toBe(0)
    })

    it('edgeFaceCounts has correct face counts', () => {
      const indices = createNonManifoldIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = checkNonManifold(edgeMap)

      // The non-manifold edge 0-1 has 3 faces
      for (const count of result.edgeFaceCounts.values()) {
        expect(count).toBeGreaterThan(2)
      }
    })
  })

  describe('checkNonManifoldFromIndices', () => {
    it('convenience function produces same result', () => {
      const indices = createNonManifoldIndices()

      const edgeMap = buildEdgeMap(indices)
      const result1 = checkNonManifold(edgeMap)
      const result2 = checkNonManifoldFromIndices(indices)

      expect(result1.hasNonManifold).toBe(result2.hasNonManifold)
      expect(result1.nonManifoldEdgeCount).toBe(result2.nonManifoldEdgeCount)
    })

    it('handles empty indices', () => {
      const indices = new Uint32Array([])
      const result = checkNonManifoldFromIndices(indices)

      expect(result.hasNonManifold).toBe(false)
      expect(result.nonManifoldEdgeCount).toBe(0)
    })

    it('handles single triangle (no non-manifold)', () => {
      const indices = new Uint32Array([0, 1, 2])
      const result = checkNonManifoldFromIndices(indices)

      expect(result.hasNonManifold).toBe(false)
    })
  })
})
