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

/** Screenshot callback function type */
export type ScreenshotCallback = () => string | null

interface ViewerState {
  showGrid: boolean
  showAxes: boolean
  wireframe: boolean
  /** Current overlay mode for visualization */
  overlayMode: OverlayMode
  /** Opacity for overlay rendering (0-1) */
  overlayOpacity: number
  /** Registered screenshot callback from MeshViewer */
  screenshotCallback: ScreenshotCallback | null

  setShowGrid: (show: boolean) => void
  setShowAxes: (show: boolean) => void
  setWireframe: (wireframe: boolean) => void
  setOverlayMode: (mode: OverlayMode) => void
  setOverlayOpacity: (opacity: number) => void
  toggleGrid: () => void
  toggleAxes: () => void
  toggleWireframe: () => void
  clearOverlay: () => void
  /** Register screenshot callback from viewer */
  registerScreenshotCallback: (callback: ScreenshotCallback) => void
  /** Unregister screenshot callback */
  unregisterScreenshotCallback: () => void
  /** Capture a screenshot (returns base64 data URL or null) */
  captureScreenshot: () => string | null
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  showGrid: true,
  showAxes: false,
  wireframe: false,
  overlayMode: 'none',
  overlayOpacity: 0.8,
  screenshotCallback: null,

  setShowGrid: (show) => set({ showGrid: show }),
  setShowAxes: (show) => set({ showAxes: show }),
  setWireframe: (wireframe) => set({ wireframe }),
  setOverlayMode: (mode) => set({ overlayMode: mode }),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: Math.max(0, Math.min(1, opacity)) }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleAxes: () => set((state) => ({ showAxes: !state.showAxes })),
  toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
  clearOverlay: () => set({ overlayMode: 'none' }),
  registerScreenshotCallback: (callback) => set({ screenshotCallback: callback }),
  unregisterScreenshotCallback: () => set({ screenshotCallback: null }),
  captureScreenshot: () => {
    const callback = get().screenshotCallback
    return callback ? callback() : null
  },
}))
