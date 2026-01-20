/**
 * Sample mesh generators for demonstrating printability issues.
 * These procedurally generated meshes showcase different failure modes.
 */

import type { MeshData } from '@/types/mesh'

export interface SampleMesh {
  id: string
  name: string
  description: string
  expectedIssue: string
  generate: () => MeshData
}

/**
 * Generates a box mesh with specified dimensions.
 * Returns positions, indices, and normals arrays.
 */
function generateBox(
  width: number,
  height: number,
  depth: number,
  offsetX = 0,
  offsetY = 0,
  offsetZ = 0
): { positions: number[]; indices: number[]; normals: number[] } {
  const hw = width / 2
  const hh = height / 2
  const hd = depth / 2

  // 8 vertices of a box
  const vertices = [
    // Front face
    [-hw + offsetX, -hh + offsetY, hd + offsetZ],
    [hw + offsetX, -hh + offsetY, hd + offsetZ],
    [hw + offsetX, hh + offsetY, hd + offsetZ],
    [-hw + offsetX, hh + offsetY, hd + offsetZ],
    // Back face
    [-hw + offsetX, -hh + offsetY, -hd + offsetZ],
    [hw + offsetX, -hh + offsetY, -hd + offsetZ],
    [hw + offsetX, hh + offsetY, -hd + offsetZ],
    [-hw + offsetX, hh + offsetY, -hd + offsetZ],
  ]

  // Face definitions (each face has 4 vertices, 2 triangles)
  const faces = [
    { verts: [0, 1, 2, 3], normal: [0, 0, 1] }, // Front
    { verts: [5, 4, 7, 6], normal: [0, 0, -1] }, // Back
    { verts: [3, 2, 6, 7], normal: [0, 1, 0] }, // Top
    { verts: [4, 5, 1, 0], normal: [0, -1, 0] }, // Bottom
    { verts: [4, 0, 3, 7], normal: [-1, 0, 0] }, // Left
    { verts: [1, 5, 6, 2], normal: [1, 0, 0] }, // Right
  ]

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  faces.forEach((face) => {
    const baseIndex = positions.length / 3

    // Add 4 vertices for this face
    face.verts.forEach((vi) => {
      positions.push(...vertices[vi])
      normals.push(...face.normal)
    })

    // Add 2 triangles (6 indices)
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2)
    indices.push(baseIndex, baseIndex + 2, baseIndex + 3)
  })

  return { positions, indices, normals }
}

/**
 * Sample A: Open Shell
 * A box-like enclosure with a missing face (top removed).
 * Expected issue: BLOCKER - not watertight (boundary edges)
 */
function generateOpenShell(): MeshData {
  const width = 30
  const height = 20
  const depth = 40

  const hw = width / 2
  const hh = height / 2
  const hd = depth / 2

  // 8 vertices of a box
  const vertices = [
    // Bottom 4 vertices
    [-hw, -hh, hd],   // 0: front-left-bottom
    [hw, -hh, hd],    // 1: front-right-bottom
    [hw, -hh, -hd],   // 2: back-right-bottom
    [-hw, -hh, -hd],  // 3: back-left-bottom
    // Top 4 vertices
    [-hw, hh, hd],    // 4: front-left-top
    [hw, hh, hd],     // 5: front-right-top
    [hw, hh, -hd],    // 6: back-right-top
    [-hw, hh, -hd],   // 7: back-left-top
  ]

  // Only 5 faces (no top face) - creates open shell
  const faces = [
    { verts: [0, 1, 5, 4], normal: [0, 0, 1] },   // Front
    { verts: [2, 3, 7, 6], normal: [0, 0, -1] },  // Back
    { verts: [3, 0, 4, 7], normal: [-1, 0, 0] },  // Left
    { verts: [1, 2, 6, 5], normal: [1, 0, 0] },   // Right
    { verts: [3, 2, 1, 0], normal: [0, -1, 0] },  // Bottom
    // Top face MISSING - creates boundary edges
  ]

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  faces.forEach((face) => {
    const baseIndex = positions.length / 3

    face.verts.forEach((vi) => {
      positions.push(...vertices[vi])
      normals.push(...face.normal)
    })

    indices.push(baseIndex, baseIndex + 1, baseIndex + 2)
    indices.push(baseIndex, baseIndex + 2, baseIndex + 3)
  })

  const positionsArray = new Float32Array(positions)
  const indicesArray = new Uint32Array(indices)
  const normalsArray = new Float32Array(normals)

  return {
    id: 'sample-open-shell',
    name: 'Open Shell (Device Enclosure)',
    positions: positionsArray,
    indices: indicesArray,
    normals: normalsArray,
    vertexCount: positionsArray.length / 3,
    triangleCount: indicesArray.length / 3,
    boundingBox: {
      min: [-hw, -hh, -hd],
      max: [hw, hh, hd],
      dimensions: [width, height, depth],
    },
  }
}

/**
 * Sample B: Floaters
 * A main body with several tiny disconnected cubes floating nearby.
 * Expected issue: WARN/FAIL - multiple components (floater components)
 */
function generateFloaters(): MeshData {
  // Main body - larger box
  const mainBox = generateBox(40, 25, 50, 0, 0, 0)

  // Floating cubes - small disconnected components
  const floater1 = generateBox(5, 5, 5, 35, 15, 20)
  const floater2 = generateBox(3, 3, 3, -30, 20, -15)
  const floater3 = generateBox(4, 4, 4, 25, -18, -25)
  const floater4 = generateBox(2, 2, 2, -35, -10, 30)

  // Combine all meshes
  const allPositions: number[] = [...mainBox.positions]
  const allNormals: number[] = [...mainBox.normals]
  const allIndices: number[] = [...mainBox.indices]

  const floaters = [floater1, floater2, floater3, floater4]

  floaters.forEach((floater) => {
    const baseIndex = allPositions.length / 3

    allPositions.push(...floater.positions)
    allNormals.push(...floater.normals)

    floater.indices.forEach((idx) => {
      allIndices.push(idx + baseIndex)
    })
  })

  const positionsArray = new Float32Array(allPositions)
  const indicesArray = new Uint32Array(allIndices)
  const normalsArray = new Float32Array(allNormals)

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (let i = 0; i < positionsArray.length; i += 3) {
    minX = Math.min(minX, positionsArray[i])
    minY = Math.min(minY, positionsArray[i + 1])
    minZ = Math.min(minZ, positionsArray[i + 2])
    maxX = Math.max(maxX, positionsArray[i])
    maxY = Math.max(maxY, positionsArray[i + 1])
    maxZ = Math.max(maxZ, positionsArray[i + 2])
  }

  return {
    id: 'sample-floaters',
    name: 'Floaters (Messy Kitbash)',
    positions: positionsArray,
    indices: indicesArray,
    normals: normalsArray,
    vertexCount: positionsArray.length / 3,
    triangleCount: indicesArray.length / 3,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      dimensions: [maxX - minX, maxY - minY, maxZ - minZ],
    },
  }
}

/**
 * Sample C: Non-manifold
 * Two boxes sharing an edge in a way that creates non-manifold geometry.
 * Expected issue: BLOCKER - non-manifold edges
 */
function generateNonManifold(): MeshData {
  // Create two boxes that share an edge
  // This creates non-manifold geometry where more than 2 faces meet at an edge

  const size = 20

  // First box
  const box1 = generateBox(size, size, size, 0, 0, 0)

  // Second box - positioned so one edge is shared with first box
  // Offset so they share the right edge of box1 with left edge of box2
  const box2 = generateBox(size, size, size, size, 0, 0)

  // Third box - creates a T-junction with non-manifold edge
  // This box shares an edge with both box1 and box2
  const box3 = generateBox(size, size / 2, size, size / 2, size * 0.75, 0)

  // Combine meshes
  const allPositions: number[] = [...box1.positions]
  const allNormals: number[] = [...box1.normals]
  const allIndices: number[] = [...box1.indices]

  // Add box2
  let baseIndex = allPositions.length / 3
  allPositions.push(...box2.positions)
  allNormals.push(...box2.normals)
  box2.indices.forEach((idx) => {
    allIndices.push(idx + baseIndex)
  })

  // Add box3
  baseIndex = allPositions.length / 3
  allPositions.push(...box3.positions)
  allNormals.push(...box3.normals)
  box3.indices.forEach((idx) => {
    allIndices.push(idx + baseIndex)
  })

  const positionsArray = new Float32Array(allPositions)
  const indicesArray = new Uint32Array(allIndices)
  const normalsArray = new Float32Array(allNormals)

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (let i = 0; i < positionsArray.length; i += 3) {
    minX = Math.min(minX, positionsArray[i])
    minY = Math.min(minY, positionsArray[i + 1])
    minZ = Math.min(minZ, positionsArray[i + 2])
    maxX = Math.max(maxX, positionsArray[i])
    maxY = Math.max(maxY, positionsArray[i + 1])
    maxZ = Math.max(maxZ, positionsArray[i + 2])
  }

  return {
    id: 'sample-non-manifold',
    name: 'Non-manifold (Bad Boolean)',
    positions: positionsArray,
    indices: indicesArray,
    normals: normalsArray,
    vertexCount: positionsArray.length / 3,
    triangleCount: indicesArray.length / 3,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      dimensions: [maxX - minX, maxY - minY, maxZ - minZ],
    },
  }
}

/**
 * All available sample meshes
 */
export const sampleMeshes: SampleMesh[] = [
  {
    id: 'open-shell',
    name: 'Open Shell',
    description: 'Device enclosure with missing top face',
    expectedIssue: 'BLOCKER: boundary edges (not watertight)',
    generate: generateOpenShell,
  },
  {
    id: 'floaters',
    name: 'Floaters',
    description: 'Main body with disconnected floating cubes',
    expectedIssue: 'RISK: multiple components (floaters)',
    generate: generateFloaters,
  },
  {
    id: 'non-manifold',
    name: 'Non-manifold',
    description: 'Bad boolean with non-manifold edges',
    expectedIssue: 'BLOCKER: non-manifold edges',
    generate: generateNonManifold,
  },
]

/**
 * Get a sample mesh by ID
 */
export function getSampleMesh(id: string): SampleMesh | undefined {
  return sampleMeshes.find((sample) => sample.id === id)
}

/**
 * Generate mesh data for a sample by ID
 */
export function generateSampleMesh(id: string): MeshData | null {
  const sample = getSampleMesh(id)
  if (!sample) return null
  return sample.generate()
}
