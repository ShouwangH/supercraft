/**
 * Bounding box for a mesh
 */
export interface BBox {
  min: [number, number, number]
  max: [number, number, number]
  dimensions: [number, number, number]
}

/**
 * Core mesh data structure
 * Represents a triangular mesh with indexed geometry
 */
export interface MeshData {
  id: string
  name: string
  positions: Float32Array // xyz triplets (length = vertexCount * 3)
  indices: Uint32Array // triangle indices (length = triangleCount * 3)
  normals?: Float32Array // vertex normals (length = vertexCount * 3)
  triangleCount: number
  vertexCount: number
  boundingBox: BBox
}

/**
 * Validates that mesh data is structurally correct
 */
export function validateMeshData(mesh: MeshData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check positions
  if (mesh.positions.length % 3 !== 0) {
    errors.push(`Positions length (${mesh.positions.length}) must be divisible by 3`)
  }

  // Check indices
  if (mesh.indices.length % 3 !== 0) {
    errors.push(`Indices length (${mesh.indices.length}) must be divisible by 3`)
  }

  // Check vertex count matches positions
  const expectedVertexCount = mesh.positions.length / 3
  if (mesh.vertexCount !== expectedVertexCount) {
    errors.push(`Vertex count (${mesh.vertexCount}) doesn't match positions (${expectedVertexCount})`)
  }

  // Check triangle count matches indices
  const expectedTriangleCount = mesh.indices.length / 3
  if (mesh.triangleCount !== expectedTriangleCount) {
    errors.push(`Triangle count (${mesh.triangleCount}) doesn't match indices (${expectedTriangleCount})`)
  }

  // Check indices are within bounds
  const maxIndex = mesh.vertexCount - 1
  for (let i = 0; i < mesh.indices.length; i++) {
    if (mesh.indices[i] > maxIndex) {
      errors.push(`Index ${i} (${mesh.indices[i]}) exceeds vertex count (${mesh.vertexCount})`)
      break // Only report first error
    }
  }

  // Check normals if present
  if (mesh.normals && mesh.normals.length !== mesh.positions.length) {
    errors.push(`Normals length (${mesh.normals.length}) must match positions length (${mesh.positions.length})`)
  }

  // Check bounding box
  for (let axis = 0; axis < 3; axis++) {
    if (mesh.boundingBox.min[axis] > mesh.boundingBox.max[axis]) {
      errors.push(`BBox min[${axis}] (${mesh.boundingBox.min[axis]}) > max[${axis}] (${mesh.boundingBox.max[axis]})`)
    }
    const expectedDim = mesh.boundingBox.max[axis] - mesh.boundingBox.min[axis]
    if (Math.abs(mesh.boundingBox.dimensions[axis] - expectedDim) > 0.0001) {
      errors.push(`BBox dimensions[${axis}] doesn't match max - min`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Computes bounding box from positions array
 */
export function computeBoundingBox(positions: Float32Array): BBox {
  if (positions.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      dimensions: [0, 0, 0],
    }
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]

  for (let i = 0; i < positions.length; i += 3) {
    min[0] = Math.min(min[0], positions[i])
    min[1] = Math.min(min[1], positions[i + 1])
    min[2] = Math.min(min[2], positions[i + 2])
    max[0] = Math.max(max[0], positions[i])
    max[1] = Math.max(max[1], positions[i + 1])
    max[2] = Math.max(max[2], positions[i + 2])
  }

  return {
    min,
    max,
    dimensions: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

/**
 * Computes vertex normals from positions and indices
 * Uses area-weighted face normals averaged at each vertex
 */
export function computeNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length)

  // Accumulate face normals at each vertex
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3
    const i1 = indices[i + 1] * 3
    const i2 = indices[i + 2] * 3

    // Get vertices
    const v0x = positions[i0],
      v0y = positions[i0 + 1],
      v0z = positions[i0 + 2]
    const v1x = positions[i1],
      v1y = positions[i1 + 1],
      v1z = positions[i1 + 2]
    const v2x = positions[i2],
      v2y = positions[i2 + 1],
      v2z = positions[i2 + 2]

    // Edge vectors
    const e1x = v1x - v0x,
      e1y = v1y - v0y,
      e1z = v1z - v0z
    const e2x = v2x - v0x,
      e2y = v2y - v0y,
      e2z = v2z - v0z

    // Cross product (not normalized - area weighted)
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    // Add to each vertex
    normals[i0] += nx
    normals[i0 + 1] += ny
    normals[i0 + 2] += nz
    normals[i1] += nx
    normals[i1 + 1] += ny
    normals[i1 + 2] += nz
    normals[i2] += nx
    normals[i2 + 1] += ny
    normals[i2 + 2] += nz
  }

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i],
      y = normals[i + 1],
      z = normals[i + 2]
    const len = Math.sqrt(x * x + y * y + z * z)
    if (len > 0) {
      normals[i] /= len
      normals[i + 1] /= len
      normals[i + 2] /= len
    }
  }

  return normals
}
