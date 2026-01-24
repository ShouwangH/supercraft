import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@/stores/viewerStore'

describe('viewerStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useViewerStore.setState({
      showGrid: false,
      showAxes: false,
      wireframe: false,
      overlayMode: 'none',
      overlayOpacity: 0.8,
      modelDarkness: 0.3,
      backgroundDarkness: 0.85,
      screenshotCallback: null,
    })
  })

  describe('initial state', () => {
    it('has grid hidden by default', () => {
      expect(useViewerStore.getState().showGrid).toBe(false)
    })

    it('has axes hidden by default', () => {
      expect(useViewerStore.getState().showAxes).toBe(false)
    })

    it('has wireframe off by default', () => {
      expect(useViewerStore.getState().wireframe).toBe(false)
    })
  })

  describe('setShowGrid', () => {
    it('sets grid visibility to true', () => {
      useViewerStore.getState().setShowGrid(true)
      expect(useViewerStore.getState().showGrid).toBe(true)
    })

    it('sets grid visibility to false', () => {
      useViewerStore.getState().setShowGrid(false)
      expect(useViewerStore.getState().showGrid).toBe(false)
    })
  })

  describe('setShowAxes', () => {
    it('sets axes visibility to true', () => {
      useViewerStore.getState().setShowAxes(true)
      expect(useViewerStore.getState().showAxes).toBe(true)
    })

    it('sets axes visibility to false', () => {
      useViewerStore.getState().setShowAxes(false)
      expect(useViewerStore.getState().showAxes).toBe(false)
    })
  })

  describe('setWireframe', () => {
    it('sets wireframe to true', () => {
      useViewerStore.getState().setWireframe(true)
      expect(useViewerStore.getState().wireframe).toBe(true)
    })

    it('sets wireframe to false', () => {
      useViewerStore.getState().setWireframe(false)
      expect(useViewerStore.getState().wireframe).toBe(false)
    })
  })

  describe('toggleGrid', () => {
    it('toggles grid from true to false', () => {
      useViewerStore.setState({ showGrid: true })
      useViewerStore.getState().toggleGrid()
      expect(useViewerStore.getState().showGrid).toBe(false)
    })

    it('toggles grid from false to true', () => {
      useViewerStore.setState({ showGrid: false })
      useViewerStore.getState().toggleGrid()
      expect(useViewerStore.getState().showGrid).toBe(true)
    })
  })

  describe('toggleAxes', () => {
    it('toggles axes from false to true', () => {
      useViewerStore.setState({ showAxes: false })
      useViewerStore.getState().toggleAxes()
      expect(useViewerStore.getState().showAxes).toBe(true)
    })

    it('toggles axes from true to false', () => {
      useViewerStore.setState({ showAxes: true })
      useViewerStore.getState().toggleAxes()
      expect(useViewerStore.getState().showAxes).toBe(false)
    })
  })

  describe('toggleWireframe', () => {
    it('toggles wireframe from false to true', () => {
      useViewerStore.setState({ wireframe: false })
      useViewerStore.getState().toggleWireframe()
      expect(useViewerStore.getState().wireframe).toBe(true)
    })

    it('toggles wireframe from true to false', () => {
      useViewerStore.setState({ wireframe: true })
      useViewerStore.getState().toggleWireframe()
      expect(useViewerStore.getState().wireframe).toBe(false)
    })
  })

  describe('overlay state', () => {
    it('has no overlay by default', () => {
      expect(useViewerStore.getState().overlayMode).toBe('none')
    })

    it('has default opacity of 0.8', () => {
      expect(useViewerStore.getState().overlayOpacity).toBe(0.8)
    })
  })

  describe('setOverlayMode', () => {
    it('sets overlay mode to boundary_edges', () => {
      useViewerStore.getState().setOverlayMode('boundary_edges')
      expect(useViewerStore.getState().overlayMode).toBe('boundary_edges')
    })

    it('sets overlay mode to non_manifold_edges', () => {
      useViewerStore.getState().setOverlayMode('non_manifold_edges')
      expect(useViewerStore.getState().overlayMode).toBe('non_manifold_edges')
    })

    it('sets overlay mode to components', () => {
      useViewerStore.getState().setOverlayMode('components')
      expect(useViewerStore.getState().overlayMode).toBe('components')
    })

    it('sets overlay mode to overhang', () => {
      useViewerStore.getState().setOverlayMode('overhang')
      expect(useViewerStore.getState().overlayMode).toBe('overhang')
    })
  })

  describe('setOverlayOpacity', () => {
    it('sets opacity within valid range', () => {
      useViewerStore.getState().setOverlayOpacity(0.5)
      expect(useViewerStore.getState().overlayOpacity).toBe(0.5)
    })

    it('clamps opacity to minimum 0', () => {
      useViewerStore.getState().setOverlayOpacity(-0.5)
      expect(useViewerStore.getState().overlayOpacity).toBe(0)
    })

    it('clamps opacity to maximum 1', () => {
      useViewerStore.getState().setOverlayOpacity(1.5)
      expect(useViewerStore.getState().overlayOpacity).toBe(1)
    })
  })

  describe('clearOverlay', () => {
    it('resets overlay mode to none', () => {
      useViewerStore.setState({ overlayMode: 'boundary_edges' })
      useViewerStore.getState().clearOverlay()
      expect(useViewerStore.getState().overlayMode).toBe('none')
    })
  })

  describe('darkness settings', () => {
    it('has default modelDarkness of 0.3', () => {
      expect(useViewerStore.getState().modelDarkness).toBe(0.3)
    })

    it('has default backgroundDarkness of 0.85', () => {
      expect(useViewerStore.getState().backgroundDarkness).toBe(0.85)
    })
  })

  describe('setModelDarkness', () => {
    it('sets model darkness within valid range', () => {
      useViewerStore.getState().setModelDarkness(0.5)
      expect(useViewerStore.getState().modelDarkness).toBe(0.5)
    })

    it('clamps model darkness to minimum 0', () => {
      useViewerStore.getState().setModelDarkness(-0.5)
      expect(useViewerStore.getState().modelDarkness).toBe(0)
    })

    it('clamps model darkness to maximum 1', () => {
      useViewerStore.getState().setModelDarkness(1.5)
      expect(useViewerStore.getState().modelDarkness).toBe(1)
    })
  })

  describe('setBackgroundDarkness', () => {
    it('sets background darkness within valid range', () => {
      useViewerStore.getState().setBackgroundDarkness(0.5)
      expect(useViewerStore.getState().backgroundDarkness).toBe(0.5)
    })

    it('clamps background darkness to minimum 0', () => {
      useViewerStore.getState().setBackgroundDarkness(-0.5)
      expect(useViewerStore.getState().backgroundDarkness).toBe(0)
    })

    it('clamps background darkness to maximum 1', () => {
      useViewerStore.getState().setBackgroundDarkness(1.5)
      expect(useViewerStore.getState().backgroundDarkness).toBe(1)
    })
  })

  describe('screenshot callback', () => {
    it('has no screenshot callback by default', () => {
      expect(useViewerStore.getState().screenshotCallback).toBeNull()
    })

    it('registers a screenshot callback', () => {
      const callback = () => 'data:image/png;base64,test'
      useViewerStore.getState().registerScreenshotCallback(callback)
      expect(useViewerStore.getState().screenshotCallback).toBe(callback)
    })

    it('unregisters the screenshot callback', () => {
      const callback = () => 'data:image/png;base64,test'
      useViewerStore.getState().registerScreenshotCallback(callback)
      useViewerStore.getState().unregisterScreenshotCallback()
      expect(useViewerStore.getState().screenshotCallback).toBeNull()
    })

    it('captures screenshot when callback is registered', () => {
      const expectedDataUrl = 'data:image/png;base64,test123'
      const callback = () => expectedDataUrl
      useViewerStore.getState().registerScreenshotCallback(callback)

      const result = useViewerStore.getState().captureScreenshot()
      expect(result).toBe(expectedDataUrl)
    })

    it('returns null when no callback is registered', () => {
      const result = useViewerStore.getState().captureScreenshot()
      expect(result).toBeNull()
    })

    it('can capture screenshot that returns null', () => {
      const callback = () => null
      useViewerStore.getState().registerScreenshotCallback(callback)

      const result = useViewerStore.getState().captureScreenshot()
      expect(result).toBeNull()
    })
  })
})
