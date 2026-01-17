import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@/stores/viewerStore'

describe('viewerStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useViewerStore.setState({
      showGrid: true,
      showAxes: false,
      wireframe: false,
    })
  })

  describe('initial state', () => {
    it('has grid visible by default', () => {
      expect(useViewerStore.getState().showGrid).toBe(true)
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
})
