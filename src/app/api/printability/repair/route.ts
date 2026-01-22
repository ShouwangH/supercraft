import { NextRequest, NextResponse } from 'next/server'
import type { MeshData } from '@/types/mesh'
import { computeBoundingBox, computeNormals } from '@/types/mesh'
import type { RepairRequest, RepairResponse, FixOperationType } from '@/types/fixPlan'
import { removeFloaters } from '@/lib/repair/removeFloaters'
import { meshCleanup } from '@/lib/repair/meshCleanup'
import { autoOrient } from '@/lib/repair/autoOrient'
import { watertightRemesh } from '@/lib/repair/watertightRemesh'

/**
 * Converts request mesh data to internal MeshData format
 */
function convertToMeshData(
  requestMesh: RepairRequest['mesh'],
  meshId: string
): MeshData {
  const positions = new Float32Array(requestMesh.positions)
  const indices = new Uint32Array(requestMesh.indices)

  const normals = requestMesh.normals
    ? new Float32Array(requestMesh.normals)
    : computeNormals(positions, indices)

  const boundingBox = computeBoundingBox(positions)
  const vertexCount = positions.length / 3
  const triangleCount = indices.length / 3

  return {
    id: meshId,
    name: 'repair-mesh',
    positions,
    indices,
    normals,
    vertexCount,
    triangleCount,
    boundingBox,
  }
}

/**
 * Converts MeshData back to response format
 */
function convertToResponseMesh(mesh: MeshData): RepairResponse['mesh'] {
  return {
    positions: Array.from(mesh.positions),
    indices: Array.from(mesh.indices),
    normals: mesh.normals ? Array.from(mesh.normals) : undefined,
  }
}

/**
 * Validates the request body
 */
function validateRequest(body: unknown): { valid: boolean; error?: string; data?: RepairRequest } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const request = body as Record<string, unknown>

  if (!request.mesh || typeof request.mesh !== 'object') {
    return { valid: false, error: 'Request must include mesh object' }
  }

  const mesh = request.mesh as Record<string, unknown>

  if (!Array.isArray(mesh.positions)) {
    return { valid: false, error: 'mesh.positions must be an array' }
  }

  if (!Array.isArray(mesh.indices)) {
    return { valid: false, error: 'mesh.indices must be an array' }
  }

  if (!request.recipeId || typeof request.recipeId !== 'string') {
    return { valid: false, error: 'Request must include recipeId' }
  }

  if (!request.recipeType || typeof request.recipeType !== 'string') {
    return { valid: false, error: 'Request must include recipeType' }
  }

  const validRecipeTypes: FixOperationType[] = [
    'remove_floaters',
    'mesh_cleanup',
    'auto_orient',
    'watertight_remesh',
  ]

  if (!validRecipeTypes.includes(request.recipeType as FixOperationType)) {
    return { valid: false, error: `Invalid recipeType: ${request.recipeType}` }
  }

  return {
    valid: true,
    data: {
      mesh: {
        positions: mesh.positions as number[],
        indices: mesh.indices as number[],
        normals: mesh.normals as number[] | undefined,
      },
      recipeId: request.recipeId as string,
      recipeType: request.recipeType as FixOperationType,
      params: request.params as Record<string, unknown> | undefined,
    },
  }
}

/**
 * POST /api/printability/repair
 *
 * Applies a fix recipe to a mesh.
 *
 * Request body:
 * {
 *   mesh: { positions: number[], indices: number[], normals?: number[] },
 *   recipeId: string,
 *   recipeType: FixOperationType,
 *   params?: Record<string, unknown>
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   mesh?: { positions: number[], indices: number[], normals?: number[] },
 *   result?: FixResult,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<RepairResponse>> {
  try {
    // Parse request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate request
    const validation = validateRequest(body)
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    const { mesh: requestMesh, recipeId, recipeType, params } = validation.data

    // Convert to internal MeshData format
    const meshId = `repair-${Date.now()}`
    const meshData = convertToMeshData(requestMesh, meshId)

    // Apply the fix based on recipe type
    let repairedMesh: MeshData
    let result

    switch (recipeType) {
      case 'remove_floaters': {
        const floaterResult = removeFloaters(meshData, {
          thresholdPercent: (params?.thresholdPercent as number) ?? 5,
        })
        repairedMesh = floaterResult.mesh
        result = floaterResult.result
        break
      }

      case 'mesh_cleanup': {
        const cleanupResult = meshCleanup(meshData, {
          areaThreshold: (params?.areaThreshold as number) ?? 1e-10,
          mergeEpsilon: (params?.mergeEpsilon as number) ?? 1e-6,
          recomputeNormals: (params?.recomputeNormals as boolean) ?? true,
        })
        repairedMesh = cleanupResult.mesh
        result = cleanupResult.result
        break
      }

      case 'auto_orient': {
        const orientResult = autoOrient(meshData, {
          overhangThresholdDeg: (params?.overhangThresholdDeg as number) ?? 45,
        })
        repairedMesh = orientResult.mesh
        result = orientResult.result
        break
      }

      case 'watertight_remesh': {
        const remeshResult = watertightRemesh(meshData, {
          maxHoleSize: (params?.maxHoleSize as number) ?? 100,
        })
        repairedMesh = remeshResult.mesh
        result = remeshResult.result
        break
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown recipe type: ${recipeType}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      mesh: convertToResponseMesh(repairedMesh),
      result,
    })
  } catch (error) {
    console.error('Repair error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
