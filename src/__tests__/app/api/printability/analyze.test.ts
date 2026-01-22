import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/printability/analyze/route'
import { NextRequest } from 'next/server'
import { REPORT_SCHEMA_VERSION } from '@/types/report'

// Helper to create a NextRequest with JSON body
function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/printability/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

// Helper to create a valid cube mesh request (10mm x 10mm x 10mm to avoid scale warnings)
function createValidCubeRequest() {
  return {
    mesh: {
      positions: [
        // Bottom face
        0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10,
        // Top face
        0, 10, 0, 10, 10, 0, 10, 10, 10, 0, 10, 10,
      ],
      indices: [
        0, 2, 1, 0, 3, 2, // Bottom
        4, 5, 6, 4, 6, 7, // Top
        3, 6, 2, 3, 7, 6, // Front
        0, 1, 5, 0, 5, 4, // Back
        0, 4, 7, 0, 7, 3, // Left
        1, 2, 6, 1, 6, 5, // Right
      ],
    },
  }
}

// Helper to create an open box request (has boundary edges) - 10mm scale
function createOpenBoxRequest() {
  return {
    mesh: {
      positions: [
        0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10,
        0, 10, 0, 10, 10, 0, 10, 10, 10, 0, 10, 10,
      ],
      indices: [
        0, 2, 1, 0, 3, 2, // Bottom
        3, 6, 2, 3, 7, 6, // Front
        0, 1, 5, 0, 5, 4, // Back
        0, 4, 7, 0, 7, 3, // Left
        1, 2, 6, 1, 6, 5, // Right
        // Top OMITTED
      ],
    },
  }
}

// Helper to create non-manifold mesh request - 10mm scale
function createNonManifoldRequest() {
  return {
    mesh: {
      positions: [
        0, 0, 0,
        10, 0, 0,
        5, 10, 0,
        5, 0, 10,
        5, 0, -10,
      ],
      indices: [
        0, 1, 2,
        0, 1, 3,
        0, 1, 4,
      ],
    },
  }
}

describe('POST /api/printability/analyze', () => {
  describe('validation', () => {
    it('returns 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/printability/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid JSON')
    })

    it('returns 400 for missing mesh object', async () => {
      const request = createRequest({})

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('mesh')
    })

    it('returns 400 for missing positions', async () => {
      const request = createRequest({
        mesh: { indices: [0, 1, 2] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('positions')
    })

    it('returns 400 for missing indices', async () => {
      const request = createRequest({
        mesh: { positions: [0, 0, 0, 1, 0, 0, 0.5, 1, 0] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('indices')
    })

    it('returns 400 for positions not divisible by 3', async () => {
      const request = createRequest({
        mesh: {
          positions: [0, 0, 0, 1], // 4 values, not divisible by 3
          indices: [0, 1, 2],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('returns 400 for indices not divisible by 3', async () => {
      const request = createRequest({
        mesh: {
          positions: [0, 0, 0, 1, 0, 0, 0.5, 1, 0],
          indices: [0, 1], // 2 values, not divisible by 3
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('returns 400 for index exceeding vertex count', async () => {
      const request = createRequest({
        mesh: {
          positions: [0, 0, 0, 1, 0, 0, 0.5, 1, 0], // 3 vertices
          indices: [0, 1, 10], // Index 10 exceeds vertex count
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('exceeds')
    })

    it('returns 400 for non-numeric positions', async () => {
      const request = createRequest({
        mesh: {
          positions: [0, 0, 'invalid', 1, 0, 0, 0.5, 1, 0],
          indices: [0, 1, 2],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('successful analysis', () => {
    it('returns valid report for closed cube', async () => {
      const request = createRequest(createValidCubeRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.report).toBeDefined()
    })

    it('report has correct schema version', async () => {
      const request = createRequest(createValidCubeRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.schemaVersion).toBe(REPORT_SCHEMA_VERSION)
    })

    it('report has mesh stats', async () => {
      const request = createRequest(createValidCubeRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.meshStats).toBeDefined()
      expect(data.report.meshStats.vertexCount).toBe(8)
      expect(data.report.meshStats.triangleCount).toBe(12)
    })

    it('returns PASS status for valid closed mesh', async () => {
      const request = createRequest(createValidCubeRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.status).toBe('PASS')
    })

    it('returns FAIL status for open mesh (boundary edges)', async () => {
      const request = createRequest(createOpenBoxRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.status).toBe('FAIL')

      const boundaryIssue = data.report.issues.find(
        (i: { type: string }) => i.type === 'boundary_edges'
      )
      expect(boundaryIssue).toBeDefined()
      expect(boundaryIssue.severity).toBe('BLOCKER')
    })

    it('returns FAIL status for non-manifold mesh', async () => {
      const request = createRequest(createNonManifoldRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.status).toBe('FAIL')

      const nmIssue = data.report.issues.find(
        (i: { type: string }) => i.type === 'non_manifold_edges'
      )
      expect(nmIssue).toBeDefined()
      expect(nmIssue.severity).toBe('BLOCKER')
    })

    it('includes overlay data in report', async () => {
      const request = createRequest(createOpenBoxRequest())

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.overlayData).toBeDefined()
      expect(data.report.overlayData.boundaryEdges).toBeDefined()
    })

    it('accepts custom printer profile', async () => {
      const requestBody = {
        ...createValidCubeRequest(),
        printerProfile: {
          overhangThresholdDeg: 30,
        },
      }
      const request = createRequest(requestBody)

      const response = await POST(request)
      const data = await response.json()

      expect(data.report.printerProfile.overhangThresholdDeg).toBe(30)
    })
  })
})
