import { create } from 'zustand'

/**
 * Available overlay modes for mesh visualization
 */
export type OverlayMode =
  | 'none'
  | 'boundary_edges'
  | 'non_manifold_edges'
  | 'components'
  | 'overhang'

interface ViewerState {
  showGrid: boolean
  showAxes: boolean
  wireframe: boolean
  /** Current overlay mode for visualization */
  overlayMode: OverlayMode
  /** Opacity for overlay rendering (0-1) */
  overlayOpacity: number

  setShowGrid: (show: boolean) => void
  setShowAxes: (show: boolean) => void
  setWireframe: (wireframe: boolean) => void
  setOverlayMode: (mode: OverlayMode) => void
  setOverlayOpacity: (opacity: number) => void
  toggleGrid: () => void
  toggleAxes: () => void
  toggleWireframe: () => void
  clearOverlay: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  showGrid: true,
  showAxes: false,
  wireframe: false,
  overlayMode: 'none',
  overlayOpacity: 0.8,

  setShowGrid: (show) => set({ showGrid: show }),
  setShowAxes: (show) => set({ showAxes: show }),
  setWireframe: (wireframe) => set({ wireframe }),
  setOverlayMode: (mode) => set({ overlayMode: mode }),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: Math.max(0, Math.min(1, opacity)) }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleAxes: () => set((state) => ({ showAxes: !state.showAxes })),
  toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
  clearOverlay: () => set({ overlayMode: 'none' }),
}))
