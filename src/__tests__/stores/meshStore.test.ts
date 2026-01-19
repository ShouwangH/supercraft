import { describe, it, expect, beforeEach } from 'vitest'
import { useMeshStore } from '@/stores/meshStore'
import type { MeshData } from '@/types/mesh'

// Helper to create a valid mesh data object
function createTestMesh(id: string, name: string = 'test-mesh'): MeshData {
  // Simple triangle
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0.5, 1, 0])
  const indices = new Uint32Array([0, 1, 2])
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])

  return {
    id,
    name,
    positions,
    indices,
    normals,
    vertexCount: 3,
    triangleCount: 1,
    boundingBox: {
      min: [0, 0, 0],
      max: [1, 1, 0],
      dimensions: [1, 1, 0],
    },
  }
}

describe('meshStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useMeshStore.setState({
      meshes: {},
      activeMeshId: null,
    })
  })

  describe('initial state', () => {
    it('has empty meshes object', () => {
      expect(useMeshStore.getState().meshes).toEqual({})
    })

    it('has null activeMeshId', () => {
      expect(useMeshStore.getState().activeMeshId).toBeNull()
    })
  })

  describe('addMesh', () => {
    it('adds mesh to store', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)

      expect(useMeshStore.getState().meshes['mesh-1']).toBe(mesh)
    })

    it('auto-selects first mesh added', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)

      expect(useMeshStore.getState().activeMeshId).toBe('mesh-1')
    })

    it('does not change active mesh when adding second mesh', () => {
      const mesh1 = createTestMesh('mesh-1')
      const mesh2 = createTestMesh('mesh-2')

      useMeshStore.getState().addMesh(mesh1)
      useMeshStore.getState().addMesh(mesh2)

      expect(useMeshStore.getState().activeMeshId).toBe('mesh-1')
    })

    it('stores multiple meshes', () => {
      const mesh1 = createTestMesh('mesh-1')
      const mesh2 = createTestMesh('mesh-2')

      useMeshStore.getState().addMesh(mesh1)
      useMeshStore.getState().addMesh(mesh2)

      expect(Object.keys(useMeshStore.getState().meshes)).toHaveLength(2)
    })
  })

  describe('removeMesh', () => {
    it('removes mesh from store', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)
      useMeshStore.getState().removeMesh('mesh-1')

      expect(useMeshStore.getState().meshes['mesh-1']).toBeUndefined()
    })

    it('clears activeMeshId when removing active mesh', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)
      useMeshStore.getState().removeMesh('mesh-1')

      expect(useMeshStore.getState().activeMeshId).toBeNull()
    })

    it('does not change activeMeshId when removing non-active mesh', () => {
      const mesh1 = createTestMesh('mesh-1')
      const mesh2 = createTestMesh('mesh-2')

      useMeshStore.getState().addMesh(mesh1)
      useMeshStore.getState().addMesh(mesh2)
      useMeshStore.getState().removeMesh('mesh-2')

      expect(useMeshStore.getState().activeMeshId).toBe('mesh-1')
    })
  })

  describe('setActiveMesh', () => {
    it('sets activeMeshId', () => {
      const mesh1 = createTestMesh('mesh-1')
      const mesh2 = createTestMesh('mesh-2')

      useMeshStore.getState().addMesh(mesh1)
      useMeshStore.getState().addMesh(mesh2)
      useMeshStore.getState().setActiveMesh('mesh-2')

      expect(useMeshStore.getState().activeMeshId).toBe('mesh-2')
    })

    it('can set activeMeshId to null', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)
      useMeshStore.getState().setActiveMesh(null)

      expect(useMeshStore.getState().activeMeshId).toBeNull()
    })
  })

  describe('getMesh', () => {
    it('returns mesh by id', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)

      expect(useMeshStore.getState().getMesh('mesh-1')).toBe(mesh)
    })

    it('returns undefined for non-existent mesh', () => {
      expect(useMeshStore.getState().getMesh('non-existent')).toBeUndefined()
    })
  })

  describe('getActiveMesh', () => {
    it('returns active mesh', () => {
      const mesh = createTestMesh('mesh-1')
      useMeshStore.getState().addMesh(mesh)

      expect(useMeshStore.getState().getActiveMesh()).toBe(mesh)
    })

    it('returns undefined when no active mesh', () => {
      expect(useMeshStore.getState().getActiveMesh()).toBeUndefined()
    })
  })
})
