import { describe, it, expect } from 'vitest'
import {
  generateOpenShell,
  generateFloaters,
  generateNonManifold,
  generateSampleMesh,
  getSampleDefinitions,
  SAMPLE_DEFINITIONS,
} from '@/lib/samples/generateSamples'
import { validateMeshData } from '@/types/mesh'

// Helper to build edge map for analysis
function buildEdgeMap(indices: Uint32Array): Map<string, number[]> {
  const edgeMap = new Map<string, number[]>()

  for (let i = 0; i < indices.length; i += 3) {
    const faceIndex = i / 3
    const v0 = indices[i]
    const v1 = indices[i + 1]
    const v2 = indices[i + 2]

    const edges = [
      [v0, v1],
      [v1, v2],
      [v2, v0],
    ]

    for (const [a, b] of edges) {
      // Use sorted key so edge direction doesn't matter
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      if (!edgeMap.has(key)) {
        edgeMap.set(key, [])
      }
      edgeMap.get(key)!.push(faceIndex)
    }
  }

  return edgeMap
}

// Count boundary edges (edges with only 1 adjacent face)
function countBoundaryEdges(indices: Uint32Array): number {
  const edgeMap = buildEdgeMap(indices)
  let count = 0
  for (const faces of edgeMap.values()) {
    if (faces.length === 1) {
      count++
    }
  }
  return count
}

// Count non-manifold edges (edges with more than 2 adjacent faces)
function countNonManifoldEdges(indices: Uint32Array): number {
  const edgeMap = buildEdgeMap(indices)
  let count = 0
  for (const faces of edgeMap.values()) {
    if (faces.length > 2) {
      count++
    }
  }
  return count
}

// Count connected components using union-find
function countConnectedComponents(indices: Uint32Array): number {
  const faceCount = indices.length / 3
  if (faceCount === 0) return 0

  // Build face adjacency via shared edges
  const edgeMap = buildEdgeMap(indices)
  const adjacency: number[][] = Array.from({ length: faceCount }, () => [])

  for (const faces of edgeMap.values()) {
    if (faces.length >= 2) {
      // Connect all faces sharing this edge
      for (let i = 0; i < faces.length; i++) {
        for (let j = i + 1; j < faces.length; j++) {
          adjacency[faces[i]].push(faces[j])
          adjacency[faces[j]].push(faces[i])
        }
      }
    }
  }

  // BFS to find connected components
  const visited = new Set<number>()
  let componentCount = 0

  for (let startFace = 0; startFace < faceCount; startFace++) {
    if (visited.has(startFace)) continue

    componentCount++
    const queue = [startFace]
    visited.add(startFace)

    while (queue.length > 0) {
      const face = queue.shift()!
      for (const neighbor of adjacency[face]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  return componentCount
}

describe('generateSamples', () => {
  describe('getSampleDefinitions', () => {
    it('returns all sample definitions', () => {
      const definitions = getSampleDefinitions()
      expect(definitions).toHaveLength(3)
      expect(definitions).toEqual(SAMPLE_DEFINITIONS)
    })

    it('each definition has required fields', () => {
      const definitions = getSampleDefinitions()
      for (const def of definitions) {
        expect(def.id).toBeDefined()
        expect(def.name).toBeDefined()
        expect(def.description).toBeDefined()
        expect(def.expectedIssues).toBeDefined()
      }
    })
  })

  describe('generateSampleMesh', () => {
    it('returns mesh for valid sample ID', () => {
      const mesh = generateSampleMesh('open-shell')
      expect(mesh).not.toBeNull()
      expect(mesh!.name).toContain('Open Shell')
    })

    it('returns null for invalid sample ID', () => {
      const mesh = generateSampleMesh('invalid-id')
      expect(mesh).toBeNull()
    })
  })

  describe('generateOpenShell', () => {
    it('generates valid mesh data', () => {
      const mesh = generateOpenShell()
      const result = validateMeshData(mesh)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('has 10 triangles (5 faces × 2 triangles each)', () => {
      const mesh = generateOpenShell()
      expect(mesh.triangleCount).toBe(10)
    })

    it('has 8 vertices', () => {
      const mesh = generateOpenShell()
      expect(mesh.vertexCount).toBe(8)
    })

    it('has exactly 4 boundary edges (open top face)', () => {
      const mesh = generateOpenShell()
      const boundaryEdgeCount = countBoundaryEdges(mesh.indices)
      expect(boundaryEdgeCount).toBe(4)
    })

    it('is deterministic (same output every call)', () => {
      const mesh1 = generateOpenShell()
      const mesh2 = generateOpenShell()

      expect(mesh1.positions).toEqual(mesh2.positions)
      expect(mesh1.indices).toEqual(mesh2.indices)
      expect(mesh1.normals).toEqual(mesh2.normals)
    })

    it('has no non-manifold edges', () => {
      const mesh = generateOpenShell()
      const nonManifoldCount = countNonManifoldEdges(mesh.indices)
      expect(nonManifoldCount).toBe(0)
    })
  })

  describe('generateFloaters', () => {
    it('generates valid mesh data', () => {
      const mesh = generateFloaters()
      const result = validateMeshData(mesh)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('has 4 cubes worth of triangles (48 triangles)', () => {
      const mesh = generateFloaters()
      // 4 cubes × 12 triangles per cube = 48
      expect(mesh.triangleCount).toBe(48)
    })

    it('has exactly 4 connected components', () => {
      const mesh = generateFloaters()
      const componentCount = countConnectedComponents(mesh.indices)
      expect(componentCount).toBe(4)
    })

    it('is deterministic (same output every call)', () => {
      const mesh1 = generateFloaters()
      const mesh2 = generateFloaters()

      expect(mesh1.positions).toEqual(mesh2.positions)
      expect(mesh1.indices).toEqual(mesh2.indices)
    })

    it('has no boundary edges (all cubes are closed)', () => {
      const mesh = generateFloaters()
      const boundaryEdgeCount = countBoundaryEdges(mesh.indices)
      expect(boundaryEdgeCount).toBe(0)
    })
  })

  describe('generateNonManifold', () => {
    it('generates valid mesh data', () => {
      const mesh = generateNonManifold()
      const result = validateMeshData(mesh)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('has 2 cubes worth of triangles (24 triangles)', () => {
      const mesh = generateNonManifold()
      // 2 cubes × 12 triangles per cube = 24
      expect(mesh.triangleCount).toBe(24)
    })

    it('has 2 connected components (T-junction creates separate components)', () => {
      const mesh = generateNonManifold()
      const componentCount = countConnectedComponents(mesh.indices)
      // The two cubes don't share edges in the mesh topology
      expect(componentCount).toBe(2)
    })

    it('is deterministic (same output every call)', () => {
      const mesh1 = generateNonManifold()
      const mesh2 = generateNonManifold()

      expect(mesh1.positions).toEqual(mesh2.positions)
      expect(mesh1.indices).toEqual(mesh2.indices)
    })

    it('has no boundary edges (both cubes are closed)', () => {
      const mesh = generateNonManifold()
      const boundaryEdgeCount = countBoundaryEdges(mesh.indices)
      expect(boundaryEdgeCount).toBe(0)
    })
  })

  describe('all samples', () => {
    const samples = [
      { name: 'open-shell', generator: generateOpenShell },
      { name: 'floaters', generator: generateFloaters },
      { name: 'non-manifold', generator: generateNonManifold },
    ]

    it.each(samples)('$name has positions divisible by 3', ({ generator }) => {
      const mesh = generator()
      expect(mesh.positions.length % 3).toBe(0)
    })

    it.each(samples)('$name has indices divisible by 3', ({ generator }) => {
      const mesh = generator()
      expect(mesh.indices.length % 3).toBe(0)
    })

    it.each(samples)('$name has valid bounding box', ({ generator }) => {
      const mesh = generator()
      for (let i = 0; i < 3; i++) {
        expect(mesh.boundingBox.min[i]).toBeLessThanOrEqual(mesh.boundingBox.max[i])
      }
    })

    it.each(samples)('$name has normals for all vertices', ({ generator }) => {
      const mesh = generator()
      expect(mesh.normals).toBeDefined()
      expect(mesh.normals!.length).toBe(mesh.positions.length)
    })

    it.each(samples)('$name indices are within vertex bounds', ({ generator }) => {
      const mesh = generator()
      const maxIndex = mesh.vertexCount - 1
      for (const index of mesh.indices) {
        expect(index).toBeLessThanOrEqual(maxIndex)
        expect(index).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
