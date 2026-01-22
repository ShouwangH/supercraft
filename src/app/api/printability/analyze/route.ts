import { NextRequest, NextResponse } from 'next/server'
import type { MeshData } from '@/types/mesh'
import { validateMeshData, computeBoundingBox, computeNormals } from '@/types/mesh'
import type { AnalyzeRequest, AnalyzeResponse, PrinterProfile } from '@/types/report'
import { DEFAULT_PRINTER_PROFILE } from '@/types/report'
import { generateReport } from '@/lib/analysis/report'

/**
 * Converts request mesh data to internal MeshData format
 */
function convertToMeshData(
  requestMesh: AnalyzeRequest['mesh'],
  meshId: string
): MeshData {
  const positions = new Float32Array(requestMesh.positions)
  const indices = new Uint32Array(requestMesh.indices)

  // Compute or use provided normals
  const normals = requestMesh.normals
    ? new Float32Array(requestMesh.normals)
    : computeNormals(positions, indices)

  const boundingBox = computeBoundingBox(positions)
  const vertexCount = positions.length / 3
  const triangleCount = indices.length / 3

  return {
    id: meshId,
    name: 'uploaded-mesh',
    positions,
    indices,
    normals,
    vertexCount,
    triangleCount,
    boundingBox,
  }
}

/**
 * Validates the request body
 */
function validateRequest(body: unknown): { valid: boolean; error?: string; data?: AnalyzeRequest } {
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

  if (mesh.positions.length === 0) {
    return { valid: false, error: 'mesh.positions cannot be empty' }
  }

  if (mesh.indices.length === 0) {
    return { valid: false, error: 'mesh.indices cannot be empty' }
  }

  if (mesh.positions.length % 3 !== 0) {
    return { valid: false, error: 'mesh.positions length must be divisible by 3' }
  }

  if (mesh.indices.length % 3 !== 0) {
    return { valid: false, error: 'mesh.indices length must be divisible by 3' }
  }

  // Check that positions are numbers
  for (const p of mesh.positions as unknown[]) {
    if (typeof p !== 'number' || !Number.isFinite(p)) {
      return { valid: false, error: 'mesh.positions must contain only finite numbers' }
    }
  }

  // Check that indices are non-negative integers
  const maxVertexIndex = (mesh.positions as number[]).length / 3 - 1
  for (const i of mesh.indices as unknown[]) {
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0) {
      return { valid: false, error: 'mesh.indices must contain only non-negative integers' }
    }
    if (i > maxVertexIndex) {
      return { valid: false, error: `mesh.indices contains index ${i} which exceeds vertex count ${maxVertexIndex + 1}` }
    }
  }

  return {
    valid: true,
    data: {
      mesh: {
        positions: mesh.positions as number[],
        indices: mesh.indices as number[],
        normals: mesh.normals as number[] | undefined,
      },
      printerProfile: request.printerProfile as Partial<PrinterProfile> | undefined,
    },
  }
}

/**
 * POST /api/printability/analyze
 *
 * Analyzes a mesh for printability issues.
 *
 * Request body:
 * {
 *   mesh: {
 *     positions: number[],  // xyz triplets
 *     indices: number[],    // triangle indices
 *     normals?: number[]    // optional vertex normals
 *   },
 *   printerProfile?: {
 *     overhangThresholdDeg?: number,
 *     maxPrintDimensionMm?: number,
 *     floaterThresholdPercent?: number
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   report?: PrintabilityReport,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
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

    const { mesh: requestMesh, printerProfile: profileOverrides } = validation.data

    // Create printer profile with overrides
    const printerProfile: PrinterProfile = {
      ...DEFAULT_PRINTER_PROFILE,
      ...profileOverrides,
    }

    // Convert to internal MeshData format
    const meshId = `analyze-${Date.now()}`
    const meshData = convertToMeshData(requestMesh, meshId)

    // Validate the converted mesh data
    const meshValidation = validateMeshData(meshData)
    if (!meshValidation.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid mesh data: ${meshValidation.errors.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate report
    const report = generateReport(meshData, printerProfile)

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
