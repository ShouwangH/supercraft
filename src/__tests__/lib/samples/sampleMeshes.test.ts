import { describe, it, expect } from 'vitest'
import {
  sampleMeshes,
  getSampleMesh,
  generateSampleMesh,
} from '@/lib/samples/sampleMeshes'

describe('sampleMeshes', () => {
  describe('sampleMeshes array', () => {
    it('contains exactly 3 sample meshes', () => {
      expect(sampleMeshes).toHaveLength(3)
    })

    it('has Open Shell sample', () => {
      const sample = sampleMeshes.find((s) => s.id === 'open-shell')
      expect(sample).toBeDefined()
      expect(sample?.name).toBe('Open Shell')
      expect(sample?.expectedIssue).toContain('boundary edges')
    })

    it('has Floaters sample', () => {
      const sample = sampleMeshes.find((s) => s.id === 'floaters')
      expect(sample).toBeDefined()
      expect(sample?.name).toBe('Floaters')
      expect(sample?.expectedIssue).toContain('components')
    })

    it('has Non-manifold sample', () => {
      const sample = sampleMeshes.find((s) => s.id === 'non-manifold')
      expect(sample).toBeDefined()
      expect(sample?.name).toBe('Non-manifold')
      expect(sample?.expectedIssue).toContain('non-manifold')
    })
  })

  describe('getSampleMesh', () => {
    it('returns sample by ID', () => {
      const sample = getSampleMesh('open-shell')
      expect(sample).toBeDefined()
      expect(sample?.id).toBe('open-shell')
    })

    it('returns undefined for unknown ID', () => {
      const sample = getSampleMesh('unknown-id')
      expect(sample).toBeUndefined()
    })
  })

  describe('generateSampleMesh', () => {
    it('returns null for unknown ID', () => {
      const mesh = generateSampleMesh('unknown-id')
      expect(mesh).toBeNull()
    })

    describe('Open Shell mesh', () => {
      it('generates valid mesh data', () => {
        const mesh = generateSampleMesh('open-shell')
        expect(mesh).not.toBeNull()
        expect(mesh!.id).toBe('sample-open-shell')
        expect(mesh!.name).toBe('Open Shell (Device Enclosure)')
      })

      it('has positions array', () => {
        const mesh = generateSampleMesh('open-shell')!
        expect(mesh.positions).toBeInstanceOf(Float32Array)
        expect(mesh.positions.length).toBeGreaterThan(0)
        expect(mesh.positions.length % 3).toBe(0) // xyz triplets
      })

      it('has indices array', () => {
        const mesh = generateSampleMesh('open-shell')!
        expect(mesh.indices).toBeInstanceOf(Uint32Array)
        expect(mesh.indices.length).toBeGreaterThan(0)
        expect(mesh.indices.length % 3).toBe(0) // triangle indices
      })

      it('has normals array', () => {
        const mesh = generateSampleMesh('open-shell')!
        expect(mesh.normals).toBeInstanceOf(Float32Array)
        expect(mesh.normals.length).toBe(mesh.positions.length)
      })

      it('has valid bounding box', () => {
        const mesh = generateSampleMesh('open-shell')!
        expect(mesh.boundingBox).toBeDefined()
        expect(mesh.boundingBox.min).toHaveLength(3)
        expect(mesh.boundingBox.max).toHaveLength(3)
        expect(mesh.boundingBox.dimensions).toHaveLength(3)
        // Max should be greater than min
        expect(mesh.boundingBox.max[0]).toBeGreaterThan(mesh.boundingBox.min[0])
        expect(mesh.boundingBox.max[1]).toBeGreaterThan(mesh.boundingBox.min[1])
        expect(mesh.boundingBox.max[2]).toBeGreaterThan(mesh.boundingBox.min[2])
      })

      it('has correct vertex and triangle counts', () => {
        const mesh = generateSampleMesh('open-shell')!
        expect(mesh.vertexCount).toBe(mesh.positions.length / 3)
        expect(mesh.triangleCount).toBe(mesh.indices.length / 3)
      })

      it('has 5 faces (missing top)', () => {
        const mesh = generateSampleMesh('open-shell')!
        // 5 faces * 2 triangles per face = 10 triangles
        expect(mesh.triangleCount).toBe(10)
      })
    })

    describe('Floaters mesh', () => {
      it('generates valid mesh data', () => {
        const mesh = generateSampleMesh('floaters')
        expect(mesh).not.toBeNull()
        expect(mesh!.id).toBe('sample-floaters')
        expect(mesh!.name).toBe('Floaters (Messy Kitbash)')
      })

      it('has positions array', () => {
        const mesh = generateSampleMesh('floaters')!
        expect(mesh.positions).toBeInstanceOf(Float32Array)
        expect(mesh.positions.length).toBeGreaterThan(0)
        expect(mesh.positions.length % 3).toBe(0)
      })

      it('has multiple components (main + floaters)', () => {
        const mesh = generateSampleMesh('floaters')!
        // 1 main box + 4 floater boxes = 5 boxes
        // Each box has 6 faces * 2 triangles = 12 triangles
        // Total = 5 * 12 = 60 triangles
        expect(mesh.triangleCount).toBe(60)
      })

      it('has valid bounding box covering all components', () => {
        const mesh = generateSampleMesh('floaters')!
        // Floaters are positioned far from origin
        // Should have large bounding box
        const width = mesh.boundingBox.dimensions[0]
        const height = mesh.boundingBox.dimensions[1]
        const depth = mesh.boundingBox.dimensions[2]

        // Main box is 40x25x50, floaters extend beyond
        expect(width).toBeGreaterThan(40)
        expect(height).toBeGreaterThan(25)
        expect(depth).toBeGreaterThan(50)
      })
    })

    describe('Non-manifold mesh', () => {
      it('generates valid mesh data', () => {
        const mesh = generateSampleMesh('non-manifold')
        expect(mesh).not.toBeNull()
        expect(mesh!.id).toBe('sample-non-manifold')
        expect(mesh!.name).toBe('Non-manifold (Bad Boolean)')
      })

      it('has positions array', () => {
        const mesh = generateSampleMesh('non-manifold')!
        expect(mesh.positions).toBeInstanceOf(Float32Array)
        expect(mesh.positions.length).toBeGreaterThan(0)
        expect(mesh.positions.length % 3).toBe(0)
      })

      it('has 3 boxes creating T-junction', () => {
        const mesh = generateSampleMesh('non-manifold')!
        // 3 boxes * 12 triangles each = 36 triangles
        expect(mesh.triangleCount).toBe(36)
      })

      it('has valid bounding box', () => {
        const mesh = generateSampleMesh('non-manifold')!
        expect(mesh.boundingBox).toBeDefined()
        // Width should cover 2 boxes side by side (box size 20 * 2 = 40)
        expect(mesh.boundingBox.dimensions[0]).toBe(40)
      })
    })
  })

  describe('mesh data integrity', () => {
    it.each(sampleMeshes)('$name generates consistent data', (sample) => {
      const mesh1 = sample.generate()
      const mesh2 = sample.generate()

      // Same structure
      expect(mesh1.positions.length).toBe(mesh2.positions.length)
      expect(mesh1.indices.length).toBe(mesh2.indices.length)
      expect(mesh1.normals.length).toBe(mesh2.normals.length)

      // Same values
      for (let i = 0; i < mesh1.positions.length; i++) {
        expect(mesh1.positions[i]).toBe(mesh2.positions[i])
      }
    })

    it.each(sampleMeshes)('$name has valid indices', (sample) => {
      const mesh = sample.generate()
      const maxVertex = mesh.positions.length / 3

      // All indices should be within valid range
      for (let i = 0; i < mesh.indices.length; i++) {
        expect(mesh.indices[i]).toBeLessThan(maxVertex)
        expect(mesh.indices[i]).toBeGreaterThanOrEqual(0)
      }
    })

    it.each(sampleMeshes)('$name has normalized normals', (sample) => {
      const mesh = sample.generate()

      // Check that normals are roughly unit length
      for (let i = 0; i < mesh.normals.length; i += 3) {
        const nx = mesh.normals[i]
        const ny = mesh.normals[i + 1]
        const nz = mesh.normals[i + 2]
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz)

        expect(length).toBeCloseTo(1, 5)
      }
    })
  })
})
