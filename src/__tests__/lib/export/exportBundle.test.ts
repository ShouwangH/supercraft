import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  downloadReportJson,
  downloadScreenshot,
  getRelevantOverlayModes,
} from '@/lib/export/exportBundle'
import type { PrintabilityReport } from '@/types/report'

// Mock document methods
const mockCreateElement = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockClick = vi.fn()

describe('exportBundle', () => {
  beforeEach(() => {
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock document methods
    mockCreateElement.mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    })
    document.createElement = mockCreateElement
    document.body.appendChild = mockAppendChild
    document.body.removeChild = mockRemoveChild
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const createMockReport = (issues: PrintabilityReport['issues'] = []): PrintabilityReport => ({
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    toolVersions: {
      app: '0.1.0',
      three: '0.182.0',
      reactFlow: '11.11.4',
    },
    meshStats: {
      vertexCount: 100,
      triangleCount: 50,
      edgeCount: 150,
      componentCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [10, 10, 10],
        dimensions: [10, 10, 10],
      },
      analysisDecimated: false,
    },
    printerProfile: {
      name: 'Test FDM',
      overhangThresholdDeg: 45,
      maxPrintDimensionMm: 300,
      floaterThresholdPercent: 5,
      maxTrianglesForAnalysis: 200000,
    },
    status: 'PASS',
    issues,
    overlayData: {},
  })

  describe('downloadReportJson', () => {
    it('should create a download link with correct filename', () => {
      const report = createMockReport()
      downloadReportJson(report, 'test-mesh')

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockClick).toHaveBeenCalled()
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('should include mesh name in filename', () => {
      const report = createMockReport()
      downloadReportJson(report, 'my-model')

      const link = mockCreateElement.mock.results[0].value
      expect(link.download).toContain('my-model')
      expect(link.download).toContain('report')
      expect(link.download).toContain('.json')
    })
  })

  describe('downloadScreenshot', () => {
    it('should create a download link for the screenshot', () => {
      const dataUrl = 'data:image/png;base64,test123'
      downloadScreenshot(dataUrl, 'test-screenshot')

      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockClick).toHaveBeenCalled()
    })

    it('should use provided name for filename', () => {
      const dataUrl = 'data:image/png;base64,test123'
      downloadScreenshot(dataUrl, 'my-view')

      const link = mockCreateElement.mock.results[0].value
      expect(link.download).toBe('my-view.png')
    })

    it('should set href to the data URL', () => {
      const dataUrl = 'data:image/png;base64,test123'
      downloadScreenshot(dataUrl, 'test')

      const link = mockCreateElement.mock.results[0].value
      expect(link.href).toBe(dataUrl)
    })
  })

  describe('getRelevantOverlayModes', () => {
    it('should always include base mode', () => {
      const report = createMockReport()
      const modes = getRelevantOverlayModes(report)

      expect(modes).toContainEqual({ mode: 'none', name: 'base' })
    })

    it('should include boundary_edges mode for boundary edge issues', () => {
      const report = createMockReport([
        {
          id: 'issue-1',
          type: 'boundary_edges',
          severity: 'BLOCKER',
          title: 'Open edges',
          summary: 'Found open edges',
          details: {},
          overlayKeys: [],
        },
      ])
      const modes = getRelevantOverlayModes(report)

      expect(modes).toContainEqual({ mode: 'boundary_edges', name: 'boundary-edges' })
    })

    it('should include non_manifold_edges mode for non-manifold issues', () => {
      const report = createMockReport([
        {
          id: 'issue-1',
          type: 'non_manifold_edges',
          severity: 'BLOCKER',
          title: 'Non-manifold edges',
          summary: 'Found non-manifold edges',
          details: {},
          overlayKeys: [],
        },
      ])
      const modes = getRelevantOverlayModes(report)

      expect(modes).toContainEqual({ mode: 'non_manifold_edges', name: 'non-manifold-edges' })
    })

    it('should include components mode for floater issues', () => {
      const report = createMockReport([
        {
          id: 'issue-1',
          type: 'floater_components',
          severity: 'RISK',
          title: 'Floaters',
          summary: 'Found floaters',
          details: {},
          overlayKeys: [],
        },
      ])
      const modes = getRelevantOverlayModes(report)

      expect(modes).toContainEqual({ mode: 'components', name: 'components' })
    })

    it('should include overhang mode for overhang issues', () => {
      const report = createMockReport([
        {
          id: 'issue-1',
          type: 'overhang',
          severity: 'RISK',
          title: 'Overhang',
          summary: 'Found overhang',
          details: {},
          overlayKeys: [],
        },
      ])
      const modes = getRelevantOverlayModes(report)

      expect(modes).toContainEqual({ mode: 'overhang', name: 'overhang' })
    })

    it('should include all relevant modes for multiple issues', () => {
      const report = createMockReport([
        {
          id: 'issue-1',
          type: 'boundary_edges',
          severity: 'BLOCKER',
          title: 'Open edges',
          summary: 'Found open edges',
          details: {},
          overlayKeys: [],
        },
        {
          id: 'issue-2',
          type: 'overhang',
          severity: 'RISK',
          title: 'Overhang',
          summary: 'Found overhang',
          details: {},
          overlayKeys: [],
        },
      ])
      const modes = getRelevantOverlayModes(report)

      expect(modes.length).toBe(3) // base + boundary + overhang
      expect(modes).toContainEqual({ mode: 'none', name: 'base' })
      expect(modes).toContainEqual({ mode: 'boundary_edges', name: 'boundary-edges' })
      expect(modes).toContainEqual({ mode: 'overhang', name: 'overhang' })
    })

    it('should not duplicate modes for multiple issues of same type', () => {
      const report = createMockReport([
        {
          id: 'issue-1',
          type: 'boundary_edges',
          severity: 'BLOCKER',
          title: 'Open edges 1',
          summary: 'Found open edges',
          details: {},
          overlayKeys: [],
        },
        {
          id: 'issue-2',
          type: 'boundary_edges',
          severity: 'BLOCKER',
          title: 'Open edges 2',
          summary: 'Found more open edges',
          details: {},
          overlayKeys: [],
        },
      ])
      const modes = getRelevantOverlayModes(report)

      expect(modes.length).toBe(2) // base + boundary (only once)
    })
  })
})
