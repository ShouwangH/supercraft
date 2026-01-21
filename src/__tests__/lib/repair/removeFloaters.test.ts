import { describe, it, expect } from 'vitest'
import { removeFloaters } from '@/lib/repair/removeFloaters'
import type { MeshData } from '@/types/mesh'

describe('removeFloaters', () => {
  // Create a mesh with main component (10 faces) and floater (1 face)
  // The floater is 1/11 ≈ 9% of total faces
  const createMeshWithFloater = (): MeshData => {
    // Main component: 10 triangles in a strip
    // Floater: 1 small triangle far away
    const positions: number[] = []
    const indices: number[] = []

    // Main component: 10 triangles sharing vertices (a strip)
    // Creates vertices: 0,1,2,3,4,5,6,7,8,9,10,11 (12 vertices)
    for (let i = 0; i <= 11; i++) {
      positions.push(i, 0, 0) // Each vertex at (i, 0, 0)
    }
    // 10 triangles: (0,1,2), (1,2,3), (2,3,4), etc.
    for (let i = 0; i < 10; i++) {
      indices.push(i, i + 1, i + 2)
    }

    // Floater: 1 triangle far away (vertices 12, 13, 14)
    positions.push(100, 100, 100)
    positions.push(101, 100, 100)
    positions.push(100.5, 101, 100)
    indices.push(12, 13, 14)

    return {
      id: 'test-mesh',
      name: 'Test Mesh',
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
      normals: new Float32Array(positions.length),
      vertexCount: 15,
      triangleCount: 11,
      boundingBox: {
        min: [0, 0, 0],
        max: [101, 101, 100],
        dimensions: [101, 101, 100],
      },
    }
  }

  // Create a simple single-triangle mesh
  const createSimpleMesh = (): MeshData => {
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0.5, 1, 0,
    ])

    const indices = new Uint32Array([0, 1, 2])

    return {
      id: 'simple-mesh',
      name: 'Simple Mesh',
      positions,
      indices,
      normals: new Float32Array(positions.length),
      vertexCount: 3,
      triangleCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 1, 0],
        dimensions: [1, 1, 0],
      },
    }
  }

  it('should return original mesh when no floaters exist', () => {
    const mesh = createSimpleMesh()
    const result = removeFloaters(mesh)

    expect(result.mesh).toBe(mesh) // Same reference
    expect(result.result.success).toBe(true)
    expect(result.result.stats.componentsRemoved).toBe(0)
    expect(result.result.stats.trianglesRemoved).toBe(0)
    expect(result.result.stats.verticesRemoved).toBe(0)
  })

  it('should remove small floater components', () => {
    const mesh = createMeshWithFloater()
    // Floater is 1/11 ≈ 9% of faces, threshold of 10% should remove it
    const result = removeFloaters(mesh, { thresholdPercent: 10 })

    expect(result.result.success).toBe(true)
    expect(result.result.stats.trianglesRemoved).toBe(1)
    expect(result.result.stats.verticesRemoved).toBe(3)
    expect(result.result.stats.componentsRemoved).toBe(1)

    // New mesh should only have the main component (10 triangles, 12 vertices)
    expect(result.mesh.triangleCount).toBe(10)
    expect(result.mesh.vertexCount).toBe(12)
  })

  it('should keep all components when threshold is 0', () => {
    const mesh = createMeshWithFloater()
    const result = removeFloaters(mesh, { thresholdPercent: 0 })

    // With 0 threshold, nothing should be removed
    expect(result.mesh.triangleCount).toBe(11)
  })

  it('should generate new mesh ID', () => {
    const mesh = createMeshWithFloater()
    // Use threshold that removes the floater
    const result = removeFloaters(mesh, { thresholdPercent: 10 })

    expect(result.mesh.id).toContain(mesh.id)
    expect(result.mesh.id).toContain('floaters-removed')
    expect(result.result.newMeshId).toBe(result.mesh.id)
  })

  it('should update mesh name', () => {
    const mesh = createMeshWithFloater()
    // Use threshold that removes the floater
    const result = removeFloaters(mesh, { thresholdPercent: 10 })

    expect(result.mesh.name).toContain(mesh.name)
    expect(result.mesh.name).toContain('floaters removed')
  })

  it('should compute correct bounding box', () => {
    const mesh = createMeshWithFloater()
    // Use threshold that removes the floater
    const result = removeFloaters(mesh, { thresholdPercent: 10 })

    // Bounding box should be for main component only (vertices 0-11 at x=0..11, y=0, z=0)
    expect(result.mesh.boundingBox.min[0]).toBe(0)
    expect(result.mesh.boundingBox.min[1]).toBe(0)
    expect(result.mesh.boundingBox.min[2]).toBe(0)
    expect(result.mesh.boundingBox.max[0]).toBe(11)
    expect(result.mesh.boundingBox.max[1]).toBe(0)
    expect(result.mesh.boundingBox.max[2]).toBe(0)
  })

  it('should preserve normals when present', () => {
    const mesh = createMeshWithFloater()
    // Set normals for all 15 vertices (12 main + 3 floater)
    const normals = new Float32Array(15 * 3)
    // Set main component normals to (0, 1, 0)
    for (let i = 0; i < 12; i++) {
      normals[i * 3 + 1] = 1 // y = 1
    }
    // Set floater normals to (0, -1, 0)
    for (let i = 12; i < 15; i++) {
      normals[i * 3 + 1] = -1 // y = -1
    }
    mesh.normals = normals

    // Use threshold that removes the floater
    const result = removeFloaters(mesh, { thresholdPercent: 10 })

    // Should only have normals for 12 kept vertices
    expect(result.mesh.normals.length).toBe(36) // 12 vertices * 3 components
    expect(result.mesh.normals[1]).toBe(1) // y component of first normal
  })

  it('should use default threshold of 5%', () => {
    const mesh = createMeshWithFloater()
    // Floater is 1/11 ≈ 9% of faces
    // Default threshold is 5%, so floater is above threshold and NOT removed
    const result = removeFloaters(mesh) // default threshold 5%

    // Floater at 9% is above 5% threshold, so it's not removed
    expect(result.result.stats.componentsRemoved).toBe(0)
  })
})
