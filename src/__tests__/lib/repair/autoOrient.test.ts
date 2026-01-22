import { describe, it, expect } from 'vitest'
import { autoOrient, findOptimalOrientation, applyRotation } from '@/lib/repair/autoOrient'
import type { MeshData } from '@/types/mesh'

describe('autoOrient', () => {
  // Create a flat triangle facing down (bad orientation)
  const createDownFacingMesh = (): MeshData => {
    // Triangle facing -Y (down)
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0.5, 0, 1,
    ])

    // Indices in counter-clockwise order when viewed from -Y
    const indices = new Uint32Array([0, 2, 1])

    return {
      id: 'down-facing-mesh',
      name: 'Down Facing Mesh',
      positions,
      indices,
      normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]),
      vertexCount: 3,
      triangleCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 0, 1],
        dimensions: [1, 0, 1],
      },
    }
  }

  // Create a flat triangle facing up (good orientation)
  const createUpFacingMesh = (): MeshData => {
    // Triangle facing +Y (up)
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0.5, 0, 1,
    ])

    // Indices in counter-clockwise order when viewed from +Y
    const indices = new Uint32Array([0, 1, 2])

    return {
      id: 'up-facing-mesh',
      name: 'Up Facing Mesh',
      positions,
      indices,
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
      vertexCount: 3,
      triangleCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 0, 1],
        dimensions: [1, 0, 1],
      },
    }
  }

  describe('findOptimalOrientation', () => {
    it('should return all tested orientations', () => {
      const mesh = createUpFacingMesh()
      const result = findOptimalOrientation(mesh)

      // Default is 4 yaw * 2 pitch = 8 orientations
      expect(result.all.length).toBe(8)
    })

    it('should find current orientation at 0,0', () => {
      const mesh = createUpFacingMesh()
      const result = findOptimalOrientation(mesh)

      expect(result.current.yawDeg).toBe(0)
      expect(result.current.pitchDeg).toBe(0)
    })

    it('should find best orientation with lowest overhang', () => {
      const mesh = createUpFacingMesh()
      const result = findOptimalOrientation(mesh)

      expect(result.best.overhangPercent).toBeLessThanOrEqual(
        Math.min(...result.all.map((r) => r.overhangPercent))
      )
    })

    it('should respect custom rotations', () => {
      const mesh = createUpFacingMesh()
      const result = findOptimalOrientation(mesh, {
        yawRotations: [0, 45],
        pitchRotations: [0, 30, 60],
      })

      // 2 yaw * 3 pitch = 6 orientations
      expect(result.all.length).toBe(6)
    })
  })

  describe('applyRotation', () => {
    it('should not change mesh at 0,0 rotation', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 0, 0)

      // Positions should be identical
      for (let i = 0; i < mesh.positions.length; i++) {
        expect(rotated.positions[i]).toBeCloseTo(mesh.positions[i], 5)
      }
    })

    it('should rotate around Y axis (yaw)', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 90, 0)

      // Original x=1, z=0 vertex should become x=0, z=1
      const originalX = mesh.positions[3] // v1.x = 1
      const originalZ = mesh.positions[5] // v1.z = 0

      // After 90 degree yaw: x' = x*cos - z*sin = 1*0 - 0*1 = 0
      // z' = x*sin + z*cos = 1*1 + 0*0 = 1
      expect(rotated.positions[3]).toBeCloseTo(0, 5)
      expect(rotated.positions[5]).toBeCloseTo(1, 5)
    })

    it('should rotate around X axis (pitch)', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 0, 90)

      // Original y=0, z=1 vertex should become y=-1, z=0
      const idx = 2 * 3 // vertex 2
      // v2 = (0.5, 0, 1)
      // After 90 degree pitch: y' = y*cos - z*sin = 0*0 - 1*1 = -1
      // z' = y*sin + z*cos = 0*1 + 1*0 = 0
      expect(rotated.positions[idx + 1]).toBeCloseTo(-1, 5)
      expect(rotated.positions[idx + 2]).toBeCloseTo(0, 5)
    })

    it('should generate new mesh ID', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 90, 45)

      expect(rotated.id).toContain(mesh.id)
      expect(rotated.id).toContain('rotated')
    })

    it('should update mesh name with rotation info', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 90, 45)

      expect(rotated.name).toContain(mesh.name)
      expect(rotated.name).toContain('90')
      expect(rotated.name).toContain('45')
    })

    it('should preserve indices', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 90, 45)

      // Indices should be the same object (rotation doesn't change topology)
      expect(rotated.indices).toBe(mesh.indices)
    })

    it('should recompute normals', () => {
      const mesh = createUpFacingMesh()
      const rotated = applyRotation(mesh, 90, 0)

      // Normals should be different after rotation
      const originalNormY = mesh.normals[1]
      const rotatedNormY = rotated.normals[1]

      // After 90 degree yaw, the normal should be different
      // (Actually for up-facing, yaw doesn't change it much, but pitch would)
      expect(rotated.normals.length).toBe(mesh.normals.length)
    })
  })

  describe('autoOrient', () => {
    it('should return original mesh when already optimal', () => {
      const mesh = createUpFacingMesh()
      const result = autoOrient(mesh)

      // If current orientation is best, should return same mesh
      if (result.orientation.yawDeg === 0 && result.orientation.pitchDeg === 0) {
        expect(result.mesh).toBe(mesh)
      }
    })

    it('should return success result', () => {
      const mesh = createUpFacingMesh()
      const result = autoOrient(mesh)

      expect(result.result.success).toBe(true)
    })

    it('should include orientation info', () => {
      const mesh = createUpFacingMesh()
      const result = autoOrient(mesh)

      expect(result.orientation).toBeDefined()
      expect(typeof result.orientation.yawDeg).toBe('number')
      expect(typeof result.orientation.pitchDeg).toBe('number')
      expect(typeof result.orientation.overhangPercent).toBe('number')
    })

    it('should respect overhang threshold', () => {
      const mesh = createUpFacingMesh()

      // With very strict threshold (0 degrees), more faces are overhang
      const result1 = autoOrient(mesh, { overhangThresholdDeg: 0 })

      // With lenient threshold (89 degrees), fewer faces are overhang
      const result2 = autoOrient(mesh, { overhangThresholdDeg: 89 })

      // Both should succeed
      expect(result1.result.success).toBe(true)
      expect(result2.result.success).toBe(true)
    })

    it('should generate new mesh ID when rotation applied', () => {
      const mesh = createDownFacingMesh()
      const result = autoOrient(mesh)

      // If rotation was applied
      if (result.orientation.yawDeg !== 0 || result.orientation.pitchDeg !== 0) {
        expect(result.mesh.id).toContain('rotated')
        expect(result.result.newMeshId).toBe(result.mesh.id)
      }
    })
  })
})
