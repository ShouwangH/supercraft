import { create } from 'zustand'

interface ViewerState {
  showGrid: boolean
  showAxes: boolean
  wireframe: boolean
  setShowGrid: (show: boolean) => void
  setShowAxes: (show: boolean) => void
  setWireframe: (wireframe: boolean) => void
  toggleGrid: () => void
  toggleAxes: () => void
  toggleWireframe: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  showGrid: true,
  showAxes: false,
  wireframe: false,
  setShowGrid: (show) => set({ showGrid: show }),
  setShowAxes: (show) => set({ showAxes: show }),
  setWireframe: (wireframe) => set({ wireframe }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleAxes: () => set((state) => ({ showAxes: !state.showAxes })),
  toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
}))
