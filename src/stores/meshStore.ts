import { create } from 'zustand'
import type { MeshData } from '@/types/mesh'

interface MeshState {
  meshes: Record<string, MeshData>
  activeMeshId: string | null

  // Actions
  addMesh: (mesh: MeshData) => void
  removeMesh: (id: string) => void
  setActiveMesh: (id: string | null) => void
  getMesh: (id: string) => MeshData | undefined
  getActiveMesh: () => MeshData | undefined
}

export const useMeshStore = create<MeshState>((set, get) => ({
  meshes: {},
  activeMeshId: null,

  addMesh: (mesh) =>
    set((state) => ({
      meshes: { ...state.meshes, [mesh.id]: mesh },
      // Auto-select first mesh added
      activeMeshId: state.activeMeshId ?? mesh.id,
    })),

  removeMesh: (id) =>
    set((state) => {
      const { [id]: removed, ...remaining } = state.meshes
      // Clear active if it was the removed mesh
      const newActiveId = state.activeMeshId === id ? null : state.activeMeshId
      return {
        meshes: remaining,
        activeMeshId: newActiveId,
      }
    }),

  setActiveMesh: (id) => set({ activeMeshId: id }),

  getMesh: (id) => get().meshes[id],

  getActiveMesh: () => {
    const state = get()
    return state.activeMeshId ? state.meshes[state.activeMeshId] : undefined
  },
}))
