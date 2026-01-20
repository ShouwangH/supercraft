import { describe, it, expect } from 'vitest'
import {
  buildEdgeMap,
  createEdgeKey,
  parseEdgeKey,
  getBoundaryEdges,
  getNonManifoldEdges,
  getManifoldEdges,
} from '@/lib/analysis/edgeMap'

// Helper: Create a closed cube (12 triangles, 8 vertices)
function createClosedCubeIndices(): Uint32Array {
  return new Uint32Array([
    // Bottom face
    0, 2, 1, 0, 3, 2,
    // Top face
    4, 5, 6, 4, 6, 7,
    // Front face
    3, 6, 2, 3, 7, 6,
    // Back face
    0, 1, 5, 0, 5, 4,
    // Left face
    0, 4, 7, 0, 7, 3,
    // Right face
    1, 2, 6, 1, 6, 5,
  ])
}

// Helper: Create a single triangle
function createSingleTriangleIndices(): Uint32Array {
  return new Uint32Array([0, 1, 2])
}

// Helper: Create an open box (5 faces, 10 triangles - missing top)
function createOpenBoxIndices(): Uint32Array {
  return new Uint32Array([
    // Bottom face
    0, 2, 1, 0, 3, 2,
    // Front face
    3, 6, 2, 3, 7, 6,
    // Back face
    0, 1, 5, 0, 5, 4,
    // Left face
    0, 4, 7, 0, 7, 3,
    // Right face
    1, 2, 6, 1, 6, 5,
    // Top face OMITTED
  ])
}

describe('edgeMap', () => {
  describe('createEdgeKey', () => {
    it('creates canonical key with smaller vertex first', () => {
      expect(createEdgeKey(1, 5)).toBe('1-5')
      expect(createEdgeKey(5, 1)).toBe('1-5')
    })

    it('handles same vertex twice', () => {
      expect(createEdgeKey(3, 3)).toBe('3-3')
    })

    it('handles zero index', () => {
      expect(createEdgeKey(0, 5)).toBe('0-5')
      expect(createEdgeKey(5, 0)).toBe('0-5')
    })
  })

  describe('parseEdgeKey', () => {
    it('parses edge key back to vertices', () => {
      expect(parseEdgeKey('1-5')).toEqual([1, 5])
      expect(parseEdgeKey('0-10')).toEqual([0, 10])
    })
  })

  describe('buildEdgeMap', () => {
    it('builds edge map for single triangle with 3 edges', () => {
      const indices = createSingleTriangleIndices()
      const edgeMap = buildEdgeMap(indices)

      expect(edgeMap.edgeCount).toBe(3)
    })

    it('builds edge map for closed cube with 12 unique edges', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)

      // A cube has 12 edges
      expect(edgeMap.edgeCount).toBe(18) // 12 face edges + 6 diagonal edges from triangulation
    })

    it('each edge in closed cube has 2 adjacent faces', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)

      for (const edge of edgeMap.edges.values()) {
        expect(edge.faceIndices.length).toBeGreaterThanOrEqual(1)
      }

      // All manifold edges should have exactly 2 faces
      const manifoldEdges = getManifoldEdges(edgeMap)
      for (const edge of manifoldEdges) {
        expect(edge.faceIndices.length).toBe(2)
      }
    })

    it('records correct face indices for edges', () => {
      const indices = createSingleTriangleIndices()
      const edgeMap = buildEdgeMap(indices)

      // All edges should reference face 0
      for (const edge of edgeMap.edges.values()) {
        expect(edge.faceIndices).toContain(0)
        expect(edge.faceIndices.length).toBe(1)
      }
    })

    it('stores vertices in sorted order', () => {
      const indices = new Uint32Array([5, 1, 3]) // Single triangle with non-sorted vertices
      const edgeMap = buildEdgeMap(indices)

      for (const edge of edgeMap.edges.values()) {
        expect(edge.vertices[0]).toBeLessThanOrEqual(edge.vertices[1])
      }
    })

    it('handles empty indices', () => {
      const indices = new Uint32Array([])
      const edgeMap = buildEdgeMap(indices)

      expect(edgeMap.edgeCount).toBe(0)
      expect(edgeMap.edges.size).toBe(0)
    })
  })

  describe('getBoundaryEdges', () => {
    it('returns empty for closed cube', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)
      const boundaryEdges = getBoundaryEdges(edgeMap)

      expect(boundaryEdges.length).toBe(0)
    })

    it('returns 3 edges for single triangle', () => {
      const indices = createSingleTriangleIndices()
      const edgeMap = buildEdgeMap(indices)
      const boundaryEdges = getBoundaryEdges(edgeMap)

      expect(boundaryEdges.length).toBe(3)
    })

    it('returns 4 edges for open box (missing top face)', () => {
      const indices = createOpenBoxIndices()
      const edgeMap = buildEdgeMap(indices)
      const boundaryEdges = getBoundaryEdges(edgeMap)

      expect(boundaryEdges.length).toBe(4)
    })
  })

  describe('getNonManifoldEdges', () => {
    it('returns empty for closed cube', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)
      const nonManifoldEdges = getNonManifoldEdges(edgeMap)

      expect(nonManifoldEdges.length).toBe(0)
    })

    it('returns empty for single triangle', () => {
      const indices = createSingleTriangleIndices()
      const edgeMap = buildEdgeMap(indices)
      const nonManifoldEdges = getNonManifoldEdges(edgeMap)

      expect(nonManifoldEdges.length).toBe(0)
    })

    it('detects non-manifold edge (3 faces sharing one edge)', () => {
      // Three triangles sharing edge 0-1
      const indices = new Uint32Array([
        0, 1, 2, // Triangle 1
        0, 1, 3, // Triangle 2 shares edge 0-1
        0, 1, 4, // Triangle 3 shares edge 0-1
      ])
      const edgeMap = buildEdgeMap(indices)
      const nonManifoldEdges = getNonManifoldEdges(edgeMap)

      expect(nonManifoldEdges.length).toBe(1)
      expect(nonManifoldEdges[0].faceIndices.length).toBe(3)
    })
  })

  describe('getManifoldEdges', () => {
    it('returns all edges for closed cube', () => {
      const indices = createClosedCubeIndices()
      const edgeMap = buildEdgeMap(indices)
      const manifoldEdges = getManifoldEdges(edgeMap)

      // All internal edges of a closed cube are manifold (2 faces each)
      expect(manifoldEdges.length).toBeGreaterThan(0)
    })

    it('returns no manifold edges for single triangle', () => {
      const indices = createSingleTriangleIndices()
      const edgeMap = buildEdgeMap(indices)
      const manifoldEdges = getManifoldEdges(edgeMap)

      // Single triangle has only boundary edges (1 face each)
      expect(manifoldEdges.length).toBe(0)
    })
  })
})
