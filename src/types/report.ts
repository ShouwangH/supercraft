/**
 * Printability Report Types
 *
 * Schema for mesh analysis reports and issues.
 */

export const REPORT_SCHEMA_VERSION = '1.0'

/**
 * Tool versions embedded in the report for traceability
 */
export interface ToolVersions {
  /** Application version */
  app: string
  /** Three.js version for rendering */
  three: string
  /** React Flow version for node graph */
  reactFlow: string
}

/**
 * Current tool versions - update when dependencies change
 */
export const TOOL_VERSIONS: ToolVersions = {
  app: '0.1.0',
  three: '0.182.0',
  reactFlow: '11.11.4',
}

export type IssueSeverity = 'BLOCKER' | 'RISK' | 'INFO'

export type IssueType =
  | 'boundary_edges'
  | 'non_manifold_edges'
  | 'floater_components'
  | 'overhang'
  | 'scale_warning'
  | 'scale_error'

export type ReportStatus = 'PASS' | 'WARN' | 'FAIL'

/**
 * A single issue found during analysis
 */
export interface Issue {
  id: string
  type: IssueType
  severity: IssueSeverity
  title: string
  summary: string
  details: Record<string, unknown>
  /** Keys for overlay data (e.g., 'boundary_edges', 'floater_faces') */
  overlayKeys: string[]
}

/**
 * Statistics about the analyzed mesh
 */
export interface MeshStats {
  vertexCount: number
  triangleCount: number
  edgeCount: number
  componentCount: number
  boundingBox: {
    min: [number, number, number]
    max: [number, number, number]
    dimensions: [number, number, number]
  }
}

/**
 * Printer profile for analysis settings
 */
export interface PrinterProfile {
  name: string
  /** Overhang threshold in degrees */
  overhangThresholdDeg: number
  /** Maximum print dimension in mm */
  maxPrintDimensionMm: number
  /** Floater threshold as percentage of total faces */
  floaterThresholdPercent: number
}

/**
 * Default printer profile
 */
export const DEFAULT_PRINTER_PROFILE: PrinterProfile = {
  name: 'Default FDM',
  overhangThresholdDeg: 45,
  maxPrintDimensionMm: 300,
  floaterThresholdPercent: 5,
}

/**
 * Overlay data for visualization
 */
export interface OverlayData {
  /** Boundary edge vertex pairs [a,b, a,b, ...] */
  boundaryEdges?: number[]
  /** Non-manifold edge vertex pairs */
  nonManifoldEdges?: number[]
  /** Component ID for each face */
  componentIdPerFace?: number[]
  /** Main component index */
  mainComponentIndex?: number
  /** Floater component indices */
  floaterIndices?: number[]
  /** Overhang face mask (1 = overhang) */
  overhangFaceMask?: number[]
  /** Face angles in degrees */
  faceAngles?: number[]
}

/**
 * Complete printability report
 */
export interface PrintabilityReport {
  schemaVersion: string
  createdAt: string
  toolVersions: ToolVersions
  meshStats: MeshStats
  printerProfile: PrinterProfile
  status: ReportStatus
  issues: Issue[]
  overlayData: OverlayData
}

/**
 * Analysis request body
 */
export interface AnalyzeRequest {
  /** Mesh data as JSON (positions, indices, etc.) */
  mesh: {
    positions: number[]
    indices: number[]
    normals?: number[]
  }
  /** Optional printer profile override */
  printerProfile?: Partial<PrinterProfile>
}

/**
 * Analysis response
 */
export interface AnalyzeResponse {
  success: boolean
  report?: PrintabilityReport
  error?: string
}
