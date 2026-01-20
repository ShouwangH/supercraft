import { describe, it, expect } from 'vitest'
import {
  findConnectedComponents,
  findConnectedComponentsFromIndices,
  getFacesInComponent,
} from '@/lib/analysis/components'
import { buildEdgeMap } from '@/lib/analysis/edgeMap'

// Helper: Create a single cube (12 triangles, 1 component)
function createSingleCubeIndices(): Uint32Array {
  return new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom
    4, 5, 6, 4, 6, 7, // Top
    3, 6, 2, 3, 7, 6, // Front
    0, 1, 5, 0, 5, 4, // Back
    0, 4, 7, 0, 7, 3, // Left
    1, 2, 6, 1, 6, 5, // Right
  ])
}

// Helper: Create two disconnected cubes (24 triangles, 2 components)
function createTwoCubesIndices(): Uint32Array {
  // First cube at origin (vertices 0-7)
  const cube1 = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    3, 6, 2, 3, 7, 6,
    0, 1, 5, 0, 5, 4,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
  ]

  // Second cube offset (vertices 8-15)
  const cube2 = cube1.map((v) => v + 8)

  return new Uint32Array([...cube1, ...cube2])
}

// Helper: Create four disconnected triangles (4 components)
function createFourTrianglesIndices(): Uint32Array {
  return new Uint32Array([
    0, 1, 2, // Triangle 1
    3, 4, 5, // Triangle 2 (disconnected)
    6, 7, 8, // Triangle 3 (disconnected)
    9, 10, 11, // Triangle 4 (disconnected)
  ])
}

// Helper: Create main cube + 3 small floaters
function createCubeWithFloatersIndices(): Uint32Array {
  // Main cube (12 triangles, vertices 0-7)
  const mainCube = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    3, 6, 2, 3, 7, 6,
    0, 1, 5, 0, 5, 4,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
  ]

  // Three small triangles as floaters
  const floater1 = [8, 9, 10]
  const floater2 = [11, 12, 13]
  const floater3 = [14, 15, 16]

  return new Uint32Array([...mainCube, ...floater1, ...floater2, ...floater3])
}

describe('components', () => {
  describe('findConnectedComponents', () => {
    it('finds 1 component for single cube', () => {
      const indices = createSingleCubeIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      expect(result.componentCount).toBe(1)
      expect(result.mainComponentIndex).toBe(0)
    })

    it('finds 2 components for two disconnected cubes', () => {
      const indices = createTwoCubesIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      expect(result.componentCount).toBe(2)
    })

    it('finds 4 components for four disconnected triangles', () => {
      const indices = createFourTrianglesIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      expect(result.componentCount).toBe(4)
    })

    it('component IDs are contiguous 0 to n-1', () => {
      const indices = createFourTrianglesIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      const uniqueIds = new Set(result.componentIdPerFace)
      expect(uniqueIds.size).toBe(result.componentCount)

      for (let i = 0; i < result.componentCount; i++) {
        expect(uniqueIds.has(i)).toBe(true)
      }
    })

    it('sum of component sizes equals total face count', () => {
      const indices = createTwoCubesIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      const totalSize = result.componentSizes.reduce((a, b) => a + b, 0)
      expect(totalSize).toBe(indices.length / 3)
    })

    it('identifies main component as largest', () => {
      const indices = createCubeWithFloatersIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      const mainSize = result.componentSizes[result.mainComponentIndex]
      for (let i = 0; i < result.componentCount; i++) {
        expect(result.componentSizes[i]).toBeLessThanOrEqual(mainSize)
      }
    })

    it('identifies floaters below threshold', () => {
      const indices = createCubeWithFloatersIndices()
      const edgeMap = buildEdgeMap(indices)
      // Threshold of 10% means components with < 1.5 faces are floaters
      // With 15 total faces, floaters need < 1.5 faces
      // But each floater triangle is 1 face, so they ARE floaters at 10% threshold
      const result = findConnectedComponents(indices, edgeMap, 10)

      // Main cube has 12 faces, 3 floaters have 1 face each
      // At 10% threshold (1.5 faces), all 3 single-triangle components are floaters
      expect(result.floaterIndices.length).toBe(3)
    })

    it('floaterFaceCount is sum of floater faces', () => {
      const indices = createCubeWithFloatersIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap, 10)

      let expectedFloaterFaces = 0
      for (const floaterIdx of result.floaterIndices) {
        expectedFloaterFaces += result.componentSizes[floaterIdx]
      }
      expect(result.floaterFaceCount).toBe(expectedFloaterFaces)
    })

    it('handles empty indices', () => {
      const indices = new Uint32Array([])
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      expect(result.componentCount).toBe(0)
      expect(result.componentIdPerFace.length).toBe(0)
      expect(result.mainComponentIndex).toBe(-1)
    })
  })

  describe('findConnectedComponentsFromIndices', () => {
    it('convenience function produces same result', () => {
      const indices = createTwoCubesIndices()

      const edgeMap = buildEdgeMap(indices)
      const result1 = findConnectedComponents(indices, edgeMap)
      const result2 = findConnectedComponentsFromIndices(indices)

      expect(result1.componentCount).toBe(result2.componentCount)
      expect(result1.mainComponentIndex).toBe(result2.mainComponentIndex)
    })
  })

  describe('getFacesInComponent', () => {
    it('returns correct faces for each component', () => {
      const indices = createFourTrianglesIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      for (let compId = 0; compId < result.componentCount; compId++) {
        const faces = getFacesInComponent(result.componentIdPerFace, compId)
        expect(faces.length).toBe(result.componentSizes[compId])
      }
    })

    it('all faces returned have correct component ID', () => {
      const indices = createTwoCubesIndices()
      const edgeMap = buildEdgeMap(indices)
      const result = findConnectedComponents(indices, edgeMap)

      const faces = getFacesInComponent(result.componentIdPerFace, 0)
      for (const face of faces) {
        expect(result.componentIdPerFace[face]).toBe(0)
      }
    })
  })
})
