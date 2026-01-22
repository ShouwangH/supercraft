import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/printability/repair/route'
import type { RepairRequest, RepairResponse } from '@/types/fixPlan'

// Helper to create mock request
function createMockRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/printability/repair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Simple triangle mesh
const simpleMesh = {
  positions: [0, 0, 0, 1, 0, 0, 0.5, 1, 0],
  indices: [0, 1, 2],
}

// Mesh with main component (10 triangles) + floater (1 triangle)
// Floater is ~9% of total faces
const meshWithFloater = (() => {
  const positions: number[] = []
  const indices: number[] = []

  // Main component: 10 triangles in a strip
  for (let i = 0; i <= 11; i++) {
    positions.push(i, 0, 0)
  }
  for (let i = 0; i < 10; i++) {
    indices.push(i, i + 1, i + 2)
  }

  // Floater: 1 triangle far away
  positions.push(100, 100, 100)
  positions.push(101, 100, 100)
  positions.push(100.5, 101, 100)
  indices.push(12, 13, 14)

  return { positions, indices }
})()

describe('POST /api/printability/repair', () => {
  describe('request validation', () => {
    it('should return 400 for invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/printability/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid JSON')
    })

    it('should return 400 for missing mesh', async () => {
      const response = await POST(
        createMockRequest({
          recipeId: 'test',
          recipeType: 'mesh_cleanup',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('mesh')
    })

    it('should return 400 for missing positions', async () => {
      const response = await POST(
        createMockRequest({
          mesh: { indices: [0, 1, 2] },
          recipeId: 'test',
          recipeType: 'mesh_cleanup',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('positions')
    })

    it('should return 400 for missing indices', async () => {
      const response = await POST(
        createMockRequest({
          mesh: { positions: [0, 0, 0] },
          recipeId: 'test',
          recipeType: 'mesh_cleanup',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('indices')
    })

    it('should return 400 for missing recipeId', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeType: 'mesh_cleanup',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('recipeId')
    })

    it('should return 400 for missing recipeType', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('recipeType')
    })

    it('should return 400 for invalid recipeType', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test',
          recipeType: 'invalid_type',
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid recipeType')
    })
  })

  describe('remove_floaters recipe', () => {
    it('should process remove_floaters successfully', async () => {
      const response = await POST(
        createMockRequest({
          mesh: meshWithFloater,
          recipeId: 'test-floaters',
          recipeType: 'remove_floaters',
          params: { thresholdPercent: 10 },
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.mesh).toBeDefined()
      expect(data.result).toBeDefined()
    })

    it('should return mesh with reduced triangles after floater removal', async () => {
      const response = await POST(
        createMockRequest({
          mesh: meshWithFloater,
          recipeId: 'test-floaters',
          recipeType: 'remove_floaters',
          params: { thresholdPercent: 10 },
        })
      )

      const data: RepairResponse = await response.json()
      // Original has 11 triangles (10 main + 1 floater), should have 10 after removing floater
      expect(data.mesh!.indices.length).toBe(30) // 10 triangles = 30 indices
    })

    it('should use default threshold when not provided', async () => {
      const response = await POST(
        createMockRequest({
          mesh: meshWithFloater,
          recipeId: 'test-floaters',
          recipeType: 'remove_floaters',
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('mesh_cleanup recipe', () => {
    it('should process mesh_cleanup successfully', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test-cleanup',
          recipeType: 'mesh_cleanup',
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.mesh).toBeDefined()
    })

    it('should accept cleanup options', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test-cleanup',
          recipeType: 'mesh_cleanup',
          params: {
            areaThreshold: 1e-8,
            mergeEpsilon: 1e-5,
            recomputeNormals: true,
          },
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('auto_orient recipe', () => {
    it('should process auto_orient successfully', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test-orient',
          recipeType: 'auto_orient',
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.mesh).toBeDefined()
    })

    it('should accept overhang threshold option', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test-orient',
          recipeType: 'auto_orient',
          params: { overhangThresholdDeg: 30 },
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('watertight_remesh recipe', () => {
    it('should process watertight_remesh successfully', async () => {
      // Create an open mesh (missing one face to create boundary edges)
      const openMesh = {
        positions: [
          0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, // Front face vertices
          0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, // Back face vertices
        ],
        indices: [
          0, 1, 2, 0, 2, 3, // Front face
          4, 6, 5, 4, 7, 6, // Back face
          0, 4, 5, 0, 5, 1, // Bottom face
          2, 6, 7, 2, 7, 3, // Top face (missing left/right to create holes)
        ],
      }

      const response = await POST(
        createMockRequest({
          mesh: openMesh,
          recipeId: 'test-remesh',
          recipeType: 'watertight_remesh',
        })
      )

      expect(response.status).toBe(200)
      const data: RepairResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.result?.stats).toBeDefined()
    })

    it('should accept maxHoleSize option', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test-remesh',
          recipeType: 'watertight_remesh',
          params: { maxHoleSize: 50 },
        })
      )

      expect(response.status).toBe(200)
    })
  })

  describe('response format', () => {
    it('should return mesh in correct format', async () => {
      const response = await POST(
        createMockRequest({
          mesh: simpleMesh,
          recipeId: 'test',
          recipeType: 'mesh_cleanup',
        })
      )

      const data: RepairResponse = await response.json()

      expect(Array.isArray(data.mesh?.positions)).toBe(true)
      expect(Array.isArray(data.mesh?.indices)).toBe(true)
    })

    it('should include result stats', async () => {
      const response = await POST(
        createMockRequest({
          mesh: meshWithFloater,
          recipeId: 'test',
          recipeType: 'remove_floaters',
          params: { thresholdPercent: 10 },
        })
      )

      const data: RepairResponse = await response.json()

      expect(data.result).toBeDefined()
      expect(data.result?.stats).toBeDefined()
    })
  })
})
