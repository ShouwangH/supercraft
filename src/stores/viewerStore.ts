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
  /** Model darkness (0 = white, 1 = black) */
  modelDarkness: number
  /** Background darkness (0 = white, 1 = black) */
  backgroundDarkness: number
  /** Registered screenshot callback from MeshViewer */
  screenshotCallback: ScreenshotCallback | null

  setShowGrid: (show: boolean) => void
  setShowAxes: (show: boolean) => void
  setWireframe: (wireframe: boolean) => void
  setOverlayMode: (mode: OverlayMode) => void
  setOverlayOpacity: (opacity: number) => void
  setModelDarkness: (darkness: number) => void
  setBackgroundDarkness: (darkness: number) => void
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
  showGrid: false,
  showAxes: false,
  wireframe: false,
  overlayMode: 'none',
  overlayOpacity: 0.8,
  modelDarkness: 0.3,
  backgroundDarkness: 0.85,
  screenshotCallback: null,

  setShowGrid: (show) => set({ showGrid: show }),
  setShowAxes: (show) => set({ showAxes: show }),
  setWireframe: (wireframe) => set({ wireframe }),
  setOverlayMode: (mode) => set({ overlayMode: mode }),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: Math.max(0, Math.min(1, opacity)) }),
  setModelDarkness: (darkness) => set({ modelDarkness: Math.max(0, Math.min(1, darkness)) }),
  setBackgroundDarkness: (darkness) => set({ backgroundDarkness: Math.max(0, Math.min(1, darkness)) }),
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
