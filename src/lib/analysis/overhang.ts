/**
 * Overhang Analysis Module
 *
 * Analyzes faces for overhang angles relative to the print direction.
 * Overhanging faces (typically > 45°) may require support structures.
 */

export interface OverhangResult {
  /** Bitmask indicating which faces are overhanging (1 = overhang, 0 = ok) */
  overhangFaceMask: Uint8Array
  /** Number of faces with overhang */
  overhangFaceCount: number
  /** Percentage of faces with overhang (0-100) */
  overhangPercentage: number
  /** Maximum overhang angle found in degrees */
  maxOverhangAngle: number
  /** Overhang angle for each face in degrees (0 = facing up, 90 = horizontal, 180 = facing down) */
  faceAngles: Float32Array
}

/**
 * Computes the face normal for a triangle.
 * Returns [nx, ny, nz] normalized vector.
 */
function computeFaceNormal(
  positions: Float32Array,
  i0: number,
  i1: number,
  i2: number
): [number, number, number] {
  // Get vertex positions
  const v0x = positions[i0 * 3]
  const v0y = positions[i0 * 3 + 1]
  const v0z = positions[i0 * 3 + 2]

  const v1x = positions[i1 * 3]
  const v1y = positions[i1 * 3 + 1]
  const v1z = positions[i1 * 3 + 2]

  const v2x = positions[i2 * 3]
  const v2y = positions[i2 * 3 + 1]
  const v2z = positions[i2 * 3 + 2]

  // Edge vectors
  const e1x = v1x - v0x
  const e1y = v1y - v0y
  const e1z = v1z - v0z

  const e2x = v2x - v0x
  const e2y = v2y - v0y
  const e2z = v2z - v0z

  // Cross product
  const nx = e1y * e2z - e1z * e2y
  const ny = e1z * e2x - e1x * e2z
  const nz = e1x * e2y - e1y * e2x

  // Normalize
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (length < 1e-10) {
    return [0, 1, 0] // Degenerate triangle, return up vector
  }

  return [nx / length, ny / length, nz / length]
}

/**
 * Computes angle between two vectors in degrees.
 */
function angleBetweenVectors(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  // Dot product
  const dot = ax * bx + ay * by + az * bz

  // Clamp to [-1, 1] to handle floating point errors
  const clampedDot = Math.max(-1, Math.min(1, dot))

  // Angle in radians, then convert to degrees
  return Math.acos(clampedDot) * (180 / Math.PI)
}

/**
 * Analyzes overhang faces in a mesh.
 *
 * For each face, computes the angle between the face normal and the up vector.
 * Faces with angles greater than the threshold are marked as overhanging.
 *
 * The overhang angle is measured from the up vector:
 * - 0° = face pointing straight up (no overhang)
 * - 90° = face horizontal (significant overhang)
 * - 180° = face pointing straight down (maximum overhang)
 *
 * @param positions - Vertex positions (xyz triplets)
 * @param indices - Triangle indices
 * @param thresholdDeg - Overhang threshold in degrees (default 45)
 * @param upVector - Print direction up vector (default [0, 1, 0])
 * @returns OverhangResult with overhang information
 */
export function analyzeOverhang(
  positions: Float32Array,
  indices: Uint32Array,
  thresholdDeg: number = 45,
  upVector: [number, number, number] = [0, 1, 0]
): OverhangResult {
  const faceCount = indices.length / 3

  if (faceCount === 0) {
    return {
      overhangFaceMask: new Uint8Array(0),
      overhangFaceCount: 0,
      overhangPercentage: 0,
      maxOverhangAngle: 0,
      faceAngles: new Float32Array(0),
    }
  }

  const overhangFaceMask = new Uint8Array(faceCount)
  const faceAngles = new Float32Array(faceCount)
  let overhangFaceCount = 0
  let maxOverhangAngle = 0

  // Normalize up vector
  const upLength = Math.sqrt(
    upVector[0] * upVector[0] + upVector[1] * upVector[1] + upVector[2] * upVector[2]
  )
  const upX = upVector[0] / upLength
  const upY = upVector[1] / upLength
  const upZ = upVector[2] / upLength

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const baseIndex = faceIndex * 3
    const i0 = indices[baseIndex]
    const i1 = indices[baseIndex + 1]
    const i2 = indices[baseIndex + 2]

    // Compute face normal
    const [nx, ny, nz] = computeFaceNormal(positions, i0, i1, i2)

    // Compute angle from up vector
    // For overhang, we care about downward-facing surfaces
    // A face is overhanging if its normal points away from up
    const angle = angleBetweenVectors(nx, ny, nz, upX, upY, upZ)

    faceAngles[faceIndex] = angle

    // Track maximum overhang angle
    if (angle > maxOverhangAngle) {
      maxOverhangAngle = angle
    }

    // Mark as overhang if angle exceeds threshold
    // Faces with normals pointing away from up (angle > 90°) are always overhanging
    // Faces with normals at angle > threshold from up need support
    if (angle > 90 + thresholdDeg) {
      overhangFaceMask[faceIndex] = 1
      overhangFaceCount++
    }
  }

  const overhangPercentage = faceCount > 0 ? (overhangFaceCount / faceCount) * 100 : 0

  return {
    overhangFaceMask,
    overhangFaceCount,
    overhangPercentage,
    maxOverhangAngle,
    faceAngles,
  }
}

/**
 * Computes a heatmap value (0-1) for an overhang angle.
 * 0 = no overhang (facing up), 1 = maximum overhang (facing down)
 *
 * @param angle - Angle from up vector in degrees
 * @param thresholdDeg - Threshold above which overhang starts
 * @returns Heat value 0-1
 */
export function getOverhangHeat(angle: number, thresholdDeg: number = 45): number {
  // Below 90° - threshold, no heat (face is above threshold)
  // From (90° + threshold) to 180°, interpolate heat from 0 to 1
  const overhangStart = 90 + thresholdDeg

  if (angle <= overhangStart) {
    return 0
  }

  // Interpolate from overhangStart (0) to 180° (1)
  const range = 180 - overhangStart
  return Math.min(1, (angle - overhangStart) / range)
}
