/**
 * Report Store
 *
 * Manages printability reports and analysis state.
 */

import { create } from 'zustand'
import type { PrintabilityReport } from '@/types/report'

export interface ReportState {
  /** Reports keyed by mesh ID */
  reports: Record<string, PrintabilityReport>
  /** Currently active report ID (mesh ID) */
  activeReportId: string | null
  /** Loading state for analysis in progress */
  analyzing: Record<string, boolean>
  /** Error messages keyed by mesh ID */
  errors: Record<string, string>

  /** Set a report for a mesh */
  setReport: (meshId: string, report: PrintabilityReport) => void
  /** Remove a report */
  removeReport: (meshId: string) => void
  /** Set the active report */
  setActiveReport: (meshId: string | null) => void
  /** Set analyzing state for a mesh */
  setAnalyzing: (meshId: string, analyzing: boolean) => void
  /** Set error for a mesh */
  setError: (meshId: string, error: string | null) => void
  /** Get report for a mesh */
  getReport: (meshId: string) => PrintabilityReport | undefined
  /** Clear all reports */
  clearReports: () => void
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: {},
  activeReportId: null,
  analyzing: {},
  errors: {},

  setReport: (meshId, report) =>
    set((state) => ({
      reports: { ...state.reports, [meshId]: report },
      errors: { ...state.errors, [meshId]: undefined } as Record<string, string>,
    })),

  removeReport: (meshId) =>
    set((state) => {
      const { [meshId]: removed, ...rest } = state.reports
      const { [meshId]: removedAnalyzing, ...restAnalyzing } = state.analyzing
      const { [meshId]: removedError, ...restErrors } = state.errors
      return {
        reports: rest,
        analyzing: restAnalyzing,
        errors: restErrors,
        activeReportId: state.activeReportId === meshId ? null : state.activeReportId,
      }
    }),

  setActiveReport: (meshId) => set({ activeReportId: meshId }),

  setAnalyzing: (meshId, analyzing) =>
    set((state) => ({
      analyzing: { ...state.analyzing, [meshId]: analyzing },
    })),

  setError: (meshId, error) =>
    set((state) => ({
      errors: error
        ? { ...state.errors, [meshId]: error }
        : (({ [meshId]: _, ...rest }) => rest)(state.errors) as Record<string, string>,
    })),

  getReport: (meshId) => get().reports[meshId],

  clearReports: () =>
    set({
      reports: {},
      activeReportId: null,
      analyzing: {},
      errors: {},
    }),
}))
