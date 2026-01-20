import type { MeshData } from '@/types/mesh'
import { computeBoundingBox, computeNormals } from '@/types/mesh'

export interface SampleMeshDefinition {
  id: string
  name: string
  description: string
  expectedIssues: string[]
}

export const SAMPLE_DEFINITIONS: SampleMeshDefinition[] = [
  {
    id: 'open-shell',
    name: 'Open Shell (Device Enclosure)',
    description: 'Box with one face removed - not watertight',
    expectedIssues: ['boundary_edges'],
  },
  {
    id: 'floaters',
    name: 'Floaters (Messy Kitbash)',
    description: 'Main cube with 3 tiny disconnected cubes',
    expectedIssues: ['floater_components'],
  },
  {
    id: 'non-manifold',
    name: 'Non-Manifold (Bad Boolean)',
    description: 'Two cubes sharing an edge - T-junction geometry',
    expectedIssues: ['non_manifold_edges'],
  },
]

/**
 * Generates Sample A: Open Shell
 * A cube with one face removed (the top face)
 * Results in 5 faces (10 triangles) and 4 boundary edges
 */
export function generateOpenShell(): MeshData {
  // Unit cube vertices
  const vertices = [
    // Bottom face vertices (y = 0)
    [0, 0, 0], // 0
    [1, 0, 0], // 1
    [1, 0, 1], // 2
    [0, 0, 1], // 3
    // Top face vertices (y = 1)
    [0, 1, 0], // 4
    [1, 1, 0], // 5
    [1, 1, 1], // 6
    [0, 1, 1], // 7
  ]

  // Faces (triangles) - CCW winding when viewed from outside
  // We omit the top face (vertices 4, 5, 6, 7) to create open shell
  const faces = [
    // Bottom face (y = 0) - facing down (CCW from below)
    [0, 2, 1],
    [0, 3, 2],
    // Front face (z = 1)
    [3, 6, 2],
    [3, 7, 6],
    // Back face (z = 0)
    [0, 1, 5],
    [0, 5, 4],
    // Left face (x = 0)
    [0, 4, 7],
    [0, 7, 3],
    // Right face (x = 1)
    [1, 2, 6],
    [1, 6, 5],
    // Top face OMITTED to create boundary edges
  ]

  const positions = new Float32Array(vertices.flat())
  const indices = new Uint32Array(faces.flat())
  const normals = computeNormals(positions, indices)
  const boundingBox = computeBoundingBox(positions)

  return {
    id: 'sample-open-shell',
    name: 'Open Shell (Device Enclosure)',
    positions,
    indices,
    normals,
    vertexCount: vertices.length,
    triangleCount: faces.length,
    boundingBox,
  }
}

/**
 * Creates a cube mesh at the given position and size
 * Returns positions and face indices
 */
function createCube(
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  size: number,
  vertexOffset: number
): { positions: number[]; indices: number[] } {
  const positions = [
    // Bottom face vertices (y = offsetY)
    offsetX, offsetY, offsetZ,
    offsetX + size, offsetY, offsetZ,
    offsetX + size, offsetY, offsetZ + size,
    offsetX, offsetY, offsetZ + size,
    // Top face vertices (y = offsetY + size)
    offsetX, offsetY + size, offsetZ,
    offsetX + size, offsetY + size, offsetZ,
    offsetX + size, offsetY + size, offsetZ + size,
    offsetX, offsetY + size, offsetZ + size,
  ]

  // Indices with vertex offset applied
  const v = vertexOffset
  const indices = [
    // Bottom face
    v + 0, v + 2, v + 1,
    v + 0, v + 3, v + 2,
    // Top face
    v + 4, v + 5, v + 6,
    v + 4, v + 6, v + 7,
    // Front face (z = max)
    v + 3, v + 6, v + 2,
    v + 3, v + 7, v + 6,
    // Back face (z = min)
    v + 0, v + 1, v + 5,
    v + 0, v + 5, v + 4,
    // Left face (x = min)
    v + 0, v + 4, v + 7,
    v + 0, v + 7, v + 3,
    // Right face (x = max)
    v + 1, v + 2, v + 6,
    v + 1, v + 6, v + 5,
  ]

  return { positions, indices }
}

/**
 * Generates Sample B: Floaters
 * Main cube (size 1) + 3 tiny disconnected cubes (size 0.1)
 * Results in 4 connected components, 3 of which are floaters
 */
export function generateFloaters(): MeshData {
  const allPositions: number[] = []
  const allIndices: number[] = []

  // Main cube at origin, size 1
  const mainCube = createCube(0, 0, 0, 1, 0)
  allPositions.push(...mainCube.positions)
  allIndices.push(...mainCube.indices)

  // Three small floater cubes (size 0.1)
  const floaterSize = 0.1
  const floaterPositions = [
    [1.5, 0.5, 0.5], // Right of main cube
    [-0.5, 0.5, 0.5], // Left of main cube
    [0.5, 1.5, 0.5], // Above main cube
  ]

  floaterPositions.forEach((pos, i) => {
    const vertexOffset = (i + 1) * 8 // Each cube has 8 vertices
    const floater = createCube(pos[0], pos[1], pos[2], floaterSize, vertexOffset)
    allPositions.push(...floater.positions)
    allIndices.push(...floater.indices)
  })

  const positions = new Float32Array(allPositions)
  const indices = new Uint32Array(allIndices)
  const normals = computeNormals(positions, indices)
  const boundingBox = computeBoundingBox(positions)

  return {
    id: 'sample-floaters',
    name: 'Floaters (Messy Kitbash)',
    positions,
    indices,
    normals,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    boundingBox,
  }
}

/**
 * Generates Sample C: Non-Manifold
 * Two cubes sharing an edge - creates T-junction (non-manifold) geometry
 * The second cube is positioned so it shares edge with first cube
 */
export function generateNonManifold(): MeshData {
  const allPositions: number[] = []
  const allIndices: number[] = []

  // First cube at origin
  const cube1 = createCube(0, 0, 0, 1, 0)
  allPositions.push(...cube1.positions)
  allIndices.push(...cube1.indices)

  // Second cube shares an edge with first cube
  // Position it so one edge of cube2 lies on the face of cube1
  // This creates a T-junction (non-manifold edge)
  const cube2 = createCube(0.5, 0.5, 1, 1, 8)
  allPositions.push(...cube2.positions)
  allIndices.push(...cube2.indices)

  const positions = new Float32Array(allPositions)
  const indices = new Uint32Array(allIndices)
  const normals = computeNormals(positions, indices)
  const boundingBox = computeBoundingBox(positions)

  return {
    id: 'sample-non-manifold',
    name: 'Non-Manifold (Bad Boolean)',
    positions,
    indices,
    normals,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    boundingBox,
  }
}

/**
 * Generates a sample mesh by ID
 */
export function generateSampleMesh(sampleId: string): MeshData | null {
  switch (sampleId) {
    case 'open-shell':
      return generateOpenShell()
    case 'floaters':
      return generateFloaters()
    case 'non-manifold':
      return generateNonManifold()
    default:
      return null
  }
}

/**
 * Returns all available sample mesh definitions
 */
export function getSampleDefinitions(): SampleMeshDefinition[] {
  return SAMPLE_DEFINITIONS
}
