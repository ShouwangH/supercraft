import { describe, it, expect } from 'vitest'
import { detectFormat, getAcceptedExtensions } from '@/lib/loaders/meshLoader'

describe('meshLoader', () => {
  describe('detectFormat', () => {
    it('detects GLB format', () => {
      expect(detectFormat('model.glb')).toBe('glb')
      expect(detectFormat('path/to/model.GLB')).toBe('glb')
    })

    it('detects GLTF format', () => {
      expect(detectFormat('model.gltf')).toBe('gltf')
      expect(detectFormat('path/to/model.GLTF')).toBe('gltf')
    })

    it('detects OBJ format', () => {
      expect(detectFormat('model.obj')).toBe('obj')
      expect(detectFormat('path/to/model.OBJ')).toBe('obj')
    })

    it('detects STL format', () => {
      expect(detectFormat('model.stl')).toBe('stl')
      expect(detectFormat('path/to/model.STL')).toBe('stl')
    })

    it('returns null for unsupported formats', () => {
      expect(detectFormat('model.fbx')).toBeNull()
      expect(detectFormat('model.blend')).toBeNull()
      expect(detectFormat('model.txt')).toBeNull()
      expect(detectFormat('model')).toBeNull()
    })

    it('handles filenames with multiple dots', () => {
      expect(detectFormat('my.model.v2.glb')).toBe('glb')
      expect(detectFormat('model.backup.stl')).toBe('stl')
    })
  })

  describe('getAcceptedExtensions', () => {
    it('returns comma-separated list of extensions', () => {
      const extensions = getAcceptedExtensions()

      expect(extensions).toContain('.glb')
      expect(extensions).toContain('.gltf')
      expect(extensions).toContain('.obj')
      expect(extensions).toContain('.stl')
    })

    it('is suitable for file input accept attribute', () => {
      const extensions = getAcceptedExtensions()

      // Should be comma-separated
      expect(extensions.split(',')).toHaveLength(4)

      // Each should start with a dot
      extensions.split(',').forEach((ext) => {
        expect(ext.startsWith('.')).toBe(true)
      })
    })
  })
})
