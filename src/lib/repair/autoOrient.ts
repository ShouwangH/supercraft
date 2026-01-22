/**
 * Auto-Orient Fix
 *
 * Finds optimal orientation to minimize overhang.
 */

import type { MeshData } from '@/types/mesh'
import type { FixResult } from '@/types/fixPlan'
import { computeNormals, computeBoundingBox } from '@/types/mesh'

export interface AutoOrientOptions {
  /** Overhang threshold in degrees */
  overhangThresholdDeg?: number
  /** Yaw rotations to test (degrees) */
  yawRotations?: number[]
  /** Pitch rotations to test (degrees) */
  pitchRotations?: number[]
}

export interface OrientationResult {
  /** Yaw rotation in degrees */
  yawDeg: number
  /** Pitch rotation in degrees */
  pitchDeg: number
  /** Percentage of faces with overhang */
  overhangPercent: number
}

/**
 * Computes overhang percentage for a given rotation.
 */
function computeOverhangForRotation(
  positions: Float32Array,
  indices: Uint32Array,
  yawRad: number,
  pitchRad: number,
  thresholdDeg: number
): number {
  const cosYaw = Math.cos(yawRad)
  const sinYaw = Math.sin(yawRad)
  const cosPitch = Math.cos(pitchRad)
  const sinPitch = Math.sin(pitchRad)

  const thresholdRad = (thresholdDeg * Math.PI) / 180
  const thresholdCos = Math.cos(thresholdRad)

  const faceCount = indices.length / 3
  let overhangCount = 0

  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3]
    const i1 = indices[f * 3 + 1]
    const i2 = indices[f * 3 + 2]

    // Get vertex positions
    let x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2]
    let x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2]
    let x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2]

    // Apply yaw (rotation around Y)
    let temp = x0 * cosYaw - z0 * sinYaw
    z0 = x0 * sinYaw + z0 * cosYaw
    x0 = temp

    temp = x1 * cosYaw - z1 * sinYaw
    z1 = x1 * sinYaw + z1 * cosYaw
    x1 = temp

    temp = x2 * cosYaw - z2 * sinYaw
    z2 = x2 * sinYaw + z2 * cosYaw
    x2 = temp

    // Apply pitch (rotation around X)
    temp = y0 * cosPitch - z0 * sinPitch
    z0 = y0 * sinPitch + z0 * cosPitch
    y0 = temp

    temp = y1 * cosPitch - z1 * sinPitch
    z1 = y1 * sinPitch + z1 * cosPitch
    y1 = temp

    temp = y2 * cosPitch - z2 * sinPitch
    z2 = y2 * sinPitch + z2 * cosPitch
    y2 = temp

    // Compute face normal
    const ax = x1 - x0, ay = y1 - y0, az = z1 - z0
    const bx = x2 - x0, by = y2 - y0, bz = z2 - z0

    const nx = ay * bz - az * by
    const ny = az * bx - ax * bz
    const nz = ax * by - ay * bx

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (len < 1e-10) continue

    // Normalize
    const normalY = ny / len

    // Check if face has overhang (normal pointing downward beyond threshold)
    // Overhang occurs when face normal points downward (negative Y)
    // and the angle from vertical exceeds threshold
    if (normalY < -thresholdCos) {
      overhangCount++
    }
  }

  return (overhangCount / faceCount) * 100
}

/**
 * Finds the optimal orientation to minimize overhang.
 *
 * @param mesh - The mesh to analyze
 * @param options - Auto-orient options
 * @returns Best orientation and all tested orientations
 */
export function findOptimalOrientation(
  mesh: MeshData,
  options: AutoOrientOptions = {}
): {
  best: OrientationResult
  all: OrientationResult[]
  current: OrientationResult
} {
  const {
    overhangThresholdDeg = 45,
    yawRotations = [0, 90, 180, 270],
    pitchRotations = [0, 90],
  } = options

  const results: OrientationResult[] = []

  // Test all combinations
  for (const yawDeg of yawRotations) {
    for (const pitchDeg of pitchRotations) {
      const yawRad = (yawDeg * Math.PI) / 180
      const pitchRad = (pitchDeg * Math.PI) / 180

      const overhangPercent = computeOverhangForRotation(
        mesh.positions,
        mesh.indices,
        yawRad,
        pitchRad,
        overhangThresholdDeg
      )

      results.push({ yawDeg, pitchDeg, overhangPercent })
    }
  }

  // Find best (lowest overhang)
  const best = results.reduce((a, b) =>
    a.overhangPercent < b.overhangPercent ? a : b
  )

  // Current orientation (no rotation)
  const current = results.find((r) => r.yawDeg === 0 && r.pitchDeg === 0)!

  return { best, all: results, current }
}

/**
 * Applies a rotation to a mesh.
 *
 * @param mesh - The mesh to rotate
 * @param yawDeg - Yaw rotation in degrees
 * @param pitchDeg - Pitch rotation in degrees
 * @returns Rotated mesh
 */
export function applyRotation(
  mesh: MeshData,
  yawDeg: number,
  pitchDeg: number
): MeshData {
  const yawRad = (yawDeg * Math.PI) / 180
  const pitchRad = (pitchDeg * Math.PI) / 180

  const cosYaw = Math.cos(yawRad)
  const sinYaw = Math.sin(yawRad)
  const cosPitch = Math.cos(pitchRad)
  const sinPitch = Math.sin(pitchRad)

  const newPositions = new Float32Array(mesh.positions.length)

  for (let i = 0; i < mesh.vertexCount; i++) {
    let x = mesh.positions[i * 3]
    let y = mesh.positions[i * 3 + 1]
    let z = mesh.positions[i * 3 + 2]

    // Apply yaw (rotation around Y)
    let temp = x * cosYaw - z * sinYaw
    z = x * sinYaw + z * cosYaw
    x = temp

    // Apply pitch (rotation around X)
    temp = y * cosPitch - z * sinPitch
    z = y * sinPitch + z * cosPitch
    y = temp

    newPositions[i * 3] = x
    newPositions[i * 3 + 1] = y
    newPositions[i * 3 + 2] = z
  }

  // Recompute normals
  const newNormals = computeNormals(newPositions, mesh.indices)

  // Recompute bounding box
  const boundingBox = computeBoundingBox(newPositions)

  return {
    id: `${mesh.id}-rotated`,
    name: `${mesh.name} (rotated ${yawDeg}° yaw, ${pitchDeg}° pitch)`,
    positions: newPositions,
    indices: mesh.indices, // Indices don't change
    normals: newNormals,
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
    boundingBox,
  }
}

/**
 * Auto-orient fix: finds optimal orientation and optionally applies it.
 *
 * @param mesh - The mesh to process
 * @param options - Auto-orient options
 * @returns Fix result with orientation suggestion
 */
export function autoOrient(
  mesh: MeshData,
  options: AutoOrientOptions = {}
): { mesh: MeshData; result: FixResult; orientation: OrientationResult } {
  const { best, current } = findOptimalOrientation(mesh, options)

  // If current is already optimal or close, don't rotate
  if (best.yawDeg === 0 && best.pitchDeg === 0) {
    return {
      mesh,
      result: {
        success: true,
        stats: {},
      },
      orientation: best,
    }
  }

  // Apply the best rotation
  const rotatedMesh = applyRotation(mesh, best.yawDeg, best.pitchDeg)

  return {
    mesh: rotatedMesh,
    result: {
      success: true,
      newMeshId: rotatedMesh.id,
      stats: {},
    },
    orientation: best,
  }
}
