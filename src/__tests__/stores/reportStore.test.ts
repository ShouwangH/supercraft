import { describe, it, expect, beforeEach } from 'vitest'
import { useReportStore } from '@/stores/reportStore'
import type { PrintabilityReport } from '@/types/report'

// Helper to create a mock report
function createMockReport(overrides: Partial<PrintabilityReport> = {}): PrintabilityReport {
  return {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    toolVersions: {
      app: '0.1.0',
      three: '0.182.0',
      reactFlow: '11.11.4',
    },
    meshStats: {
      vertexCount: 8,
      triangleCount: 12,
      edgeCount: 18,
      componentCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [10, 10, 10],
        dimensions: [10, 10, 10],
      },
    },
    printerProfile: {
      name: 'Default FDM',
      overhangThresholdDeg: 45,
      maxPrintDimensionMm: 300,
      floaterThresholdPercent: 5,
    },
    status: 'PASS',
    issues: [],
    overlayData: {},
    ...overrides,
  }
}

describe('reportStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useReportStore.getState().clearReports()
  })

  describe('initial state', () => {
    it('has empty reports', () => {
      expect(useReportStore.getState().reports).toEqual({})
    })

    it('has no active report', () => {
      expect(useReportStore.getState().activeReportId).toBeNull()
    })

    it('has no analyzing state', () => {
      expect(useReportStore.getState().analyzing).toEqual({})
    })

    it('has no errors', () => {
      expect(useReportStore.getState().errors).toEqual({})
    })
  })

  describe('setReport', () => {
    it('stores a report for a mesh', () => {
      const report = createMockReport()
      useReportStore.getState().setReport('mesh-1', report)

      expect(useReportStore.getState().reports['mesh-1']).toEqual(report)
    })

    it('overwrites existing report', () => {
      const report1 = createMockReport({ status: 'PASS' })
      const report2 = createMockReport({ status: 'FAIL' })

      useReportStore.getState().setReport('mesh-1', report1)
      useReportStore.getState().setReport('mesh-1', report2)

      expect(useReportStore.getState().reports['mesh-1'].status).toBe('FAIL')
    })

    it('clears error when setting report', () => {
      useReportStore.getState().setError('mesh-1', 'Some error')
      const report = createMockReport()
      useReportStore.getState().setReport('mesh-1', report)

      expect(useReportStore.getState().errors['mesh-1']).toBeUndefined()
    })
  })

  describe('removeReport', () => {
    it('removes a report', () => {
      const report = createMockReport()
      useReportStore.getState().setReport('mesh-1', report)
      useReportStore.getState().removeReport('mesh-1')

      expect(useReportStore.getState().reports['mesh-1']).toBeUndefined()
    })

    it('clears active report if it was removed', () => {
      const report = createMockReport()
      useReportStore.getState().setReport('mesh-1', report)
      useReportStore.getState().setActiveReport('mesh-1')
      useReportStore.getState().removeReport('mesh-1')

      expect(useReportStore.getState().activeReportId).toBeNull()
    })

    it('keeps active report if different mesh was removed', () => {
      const report1 = createMockReport()
      const report2 = createMockReport()
      useReportStore.getState().setReport('mesh-1', report1)
      useReportStore.getState().setReport('mesh-2', report2)
      useReportStore.getState().setActiveReport('mesh-1')
      useReportStore.getState().removeReport('mesh-2')

      expect(useReportStore.getState().activeReportId).toBe('mesh-1')
    })

    it('removes analyzing state when removing report', () => {
      useReportStore.getState().setAnalyzing('mesh-1', true)
      useReportStore.getState().removeReport('mesh-1')

      expect(useReportStore.getState().analyzing['mesh-1']).toBeUndefined()
    })

    it('removes error when removing report', () => {
      useReportStore.getState().setError('mesh-1', 'Some error')
      useReportStore.getState().removeReport('mesh-1')

      expect(useReportStore.getState().errors['mesh-1']).toBeUndefined()
    })
  })

  describe('setActiveReport', () => {
    it('sets active report', () => {
      useReportStore.getState().setActiveReport('mesh-1')
      expect(useReportStore.getState().activeReportId).toBe('mesh-1')
    })

    it('can clear active report', () => {
      useReportStore.getState().setActiveReport('mesh-1')
      useReportStore.getState().setActiveReport(null)
      expect(useReportStore.getState().activeReportId).toBeNull()
    })
  })

  describe('setAnalyzing', () => {
    it('sets analyzing state to true', () => {
      useReportStore.getState().setAnalyzing('mesh-1', true)
      expect(useReportStore.getState().analyzing['mesh-1']).toBe(true)
    })

    it('sets analyzing state to false', () => {
      useReportStore.getState().setAnalyzing('mesh-1', true)
      useReportStore.getState().setAnalyzing('mesh-1', false)
      expect(useReportStore.getState().analyzing['mesh-1']).toBe(false)
    })
  })

  describe('setError', () => {
    it('sets error message', () => {
      useReportStore.getState().setError('mesh-1', 'Analysis failed')
      expect(useReportStore.getState().errors['mesh-1']).toBe('Analysis failed')
    })

    it('clears error when set to null', () => {
      useReportStore.getState().setError('mesh-1', 'Analysis failed')
      useReportStore.getState().setError('mesh-1', null)
      expect(useReportStore.getState().errors['mesh-1']).toBeUndefined()
    })
  })

  describe('getReport', () => {
    it('returns report for mesh', () => {
      const report = createMockReport()
      useReportStore.getState().setReport('mesh-1', report)

      const retrieved = useReportStore.getState().getReport('mesh-1')
      expect(retrieved).toEqual(report)
    })

    it('returns undefined for non-existent mesh', () => {
      const retrieved = useReportStore.getState().getReport('non-existent')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('clearReports', () => {
    it('clears all reports', () => {
      useReportStore.getState().setReport('mesh-1', createMockReport())
      useReportStore.getState().setReport('mesh-2', createMockReport())
      useReportStore.getState().setActiveReport('mesh-1')
      useReportStore.getState().setAnalyzing('mesh-1', true)
      useReportStore.getState().setError('mesh-2', 'Error')

      useReportStore.getState().clearReports()

      expect(useReportStore.getState().reports).toEqual({})
      expect(useReportStore.getState().activeReportId).toBeNull()
      expect(useReportStore.getState().analyzing).toEqual({})
      expect(useReportStore.getState().errors).toEqual({})
    })
  })
})
