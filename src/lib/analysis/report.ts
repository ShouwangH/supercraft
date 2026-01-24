/**
 * Report Generator Module
 *
 * Orchestrates all analysis checks and generates a comprehensive printability report.
 */

import type { MeshData } from '@/types/mesh'
import type {
  PrintabilityReport,
  Issue,
  MeshStats,
  PrinterProfile,
  OverlayData,
  ReportStatus,
  IssueSeverity,
} from '@/types/report'
import { REPORT_SCHEMA_VERSION, DEFAULT_PRINTER_PROFILE, TOOL_VERSIONS } from '@/types/report'

import { buildEdgeMap } from './edgeMap'
import { checkWatertight } from './watertight'
import { checkNonManifold } from './nonManifold'
import { findConnectedComponents } from './components'
import { analyzeOverhang } from './overhang'
import { checkScale } from './scale'
import { decimateForAnalysis } from './decimation'

/**
 * Results from all analysis checks
 */
export interface AnalysisResults {
  watertight: ReturnType<typeof checkWatertight>
  nonManifold: ReturnType<typeof checkNonManifold>
  components: ReturnType<typeof findConnectedComponents>
  overhang: ReturnType<typeof analyzeOverhang>
  scale: ReturnType<typeof checkScale>
  edgeCount: number
}

/**
 * Runs all analysis checks on a mesh
 */
export function runAllAnalysis(mesh: MeshData, profile: PrinterProfile): AnalysisResults {
  // Build edge map once, reuse for multiple checks
  const edgeMap = buildEdgeMap(mesh.indices)

  // Run all checks
  const watertight = checkWatertight(edgeMap)
  const nonManifold = checkNonManifold(edgeMap)
  const components = findConnectedComponents(mesh.indices, edgeMap, profile.floaterThresholdPercent)
  const overhang = analyzeOverhang(mesh.positions, mesh.indices, profile.overhangThresholdDeg)
  const scale = checkScale(mesh.boundingBox, { idealMaxDimensionMm: profile.maxPrintDimensionMm })

  return {
    watertight,
    nonManifold,
    components,
    overhang,
    scale,
    edgeCount: edgeMap.edgeCount,
  }
}

/**
 * Generates issues from analysis results
 */
function generateIssues(results: AnalysisResults): Issue[] {
  const issues: Issue[] = []
  let issueId = 1

  // Boundary edges (BLOCKER)
  if (!results.watertight.isWatertight) {
    issues.push({
      id: `issue-${issueId++}`,
      type: 'boundary_edges',
      severity: 'BLOCKER',
      title: 'Mesh Not Watertight',
      summary: `Found ${results.watertight.boundaryEdgeCount} boundary edge${results.watertight.boundaryEdgeCount !== 1 ? 's' : ''}. The mesh has holes that will cause printing issues.`,
      details: {
        boundaryEdgeCount: results.watertight.boundaryEdgeCount,
      },
      overlayKeys: ['boundary_edges'],
    })
  }

  // Non-manifold edges (BLOCKER)
  if (results.nonManifold.hasNonManifold) {
    issues.push({
      id: `issue-${issueId++}`,
      type: 'non_manifold_edges',
      severity: 'BLOCKER',
      title: 'Non-Manifold Geometry',
      summary: `Found ${results.nonManifold.nonManifoldEdgeCount} non-manifold edge${results.nonManifold.nonManifoldEdgeCount !== 1 ? 's' : ''}. These edges are shared by more than 2 faces.`,
      details: {
        nonManifoldEdgeCount: results.nonManifold.nonManifoldEdgeCount,
      },
      overlayKeys: ['non_manifold_edges'],
    })
  }

  // Floater/disconnected components (RISK)
  // Detect either: small floaters below threshold OR multiple disconnected components
  const hasFloaters = results.components.floaterIndices.length > 0
  const hasMultipleComponents = results.components.componentCount > 1

  if (hasFloaters || hasMultipleComponents) {
    const floaterCount = hasFloaters
      ? results.components.floaterIndices.length
      : results.components.componentCount - 1
    const floaterFaceCount = hasFloaters
      ? results.components.floaterFaceCount
      : results.components.componentSizes.reduce((a, b) => a + b, 0) - results.components.componentSizes[results.components.mainComponentIndex]

    issues.push({
      id: `issue-${issueId++}`,
      type: 'floater_components',
      severity: 'RISK',
      title: 'Disconnected Geometry',
      summary: `Found ${floaterCount} disconnected component${floaterCount !== 1 ? 's' : ''} (${floaterFaceCount} face${floaterFaceCount !== 1 ? 's' : ''} total).`,
      details: {
        floaterCount,
        floaterFaceCount,
        componentCount: results.components.componentCount,
      },
      overlayKeys: ['floater_components'],
    })
  }

  // Overhang (RISK if > 20%)
  if (results.overhang.overhangPercentage > 20) {
    issues.push({
      id: `issue-${issueId++}`,
      type: 'overhang',
      severity: 'RISK',
      title: 'Significant Overhang',
      summary: `${results.overhang.overhangPercentage.toFixed(1)}% of faces have overhang. May require support structures.`,
      details: {
        overhangPercentage: results.overhang.overhangPercentage,
        overhangFaceCount: results.overhang.overhangFaceCount,
        maxOverhangAngle: results.overhang.maxOverhangAngle,
      },
      overlayKeys: ['overhang'],
    })
  }

  // Scale issues
  if (results.scale.severity === 'error') {
    issues.push({
      id: `issue-${issueId++}`,
      type: 'scale_error',
      severity: 'BLOCKER',
      title: 'Scale Problem',
      summary: results.scale.warning || 'Mesh dimensions are outside acceptable range.',
      details: {
        maxDimensionMm: results.scale.maxDimensionMm,
        minDimensionMm: results.scale.minDimensionMm,
        suggestedScaleFactor: results.scale.suggestedScaleFactor,
      },
      overlayKeys: [],
    })
  } else if (results.scale.severity === 'warning') {
    issues.push({
      id: `issue-${issueId++}`,
      type: 'scale_warning',
      severity: 'RISK',
      title: 'Scale Advisory',
      summary: results.scale.warning || 'Mesh dimensions may cause issues.',
      details: {
        maxDimensionMm: results.scale.maxDimensionMm,
        minDimensionMm: results.scale.minDimensionMm,
        suggestedScaleFactor: results.scale.suggestedScaleFactor,
      },
      overlayKeys: [],
    })
  }

  // Sort by severity: BLOCKER first, then RISK, then INFO
  const severityOrder: Record<IssueSeverity, number> = { BLOCKER: 0, RISK: 1, INFO: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return issues
}

/**
 * Determines report status based on issues
 */
function determineStatus(issues: Issue[]): ReportStatus {
  const hasBlocker = issues.some((i) => i.severity === 'BLOCKER')
  if (hasBlocker) return 'FAIL'

  const hasRisk = issues.some((i) => i.severity === 'RISK')
  if (hasRisk) return 'WARN'

  return 'PASS'
}

/**
 * Creates overlay data from analysis results
 */
function createOverlayData(results: AnalysisResults): OverlayData {
  return {
    boundaryEdges: results.watertight.boundaryEdges,
    nonManifoldEdges: results.nonManifold.nonManifoldEdges,
    componentIdPerFace: Array.from(results.components.componentIdPerFace),
    mainComponentIndex: results.components.mainComponentIndex,
    floaterIndices: results.components.floaterIndices,
    overhangFaceMask: Array.from(results.overhang.overhangFaceMask),
    faceAngles: Array.from(results.overhang.faceAngles),
  }
}

/**
 * Creates mesh statistics
 */
function createMeshStats(
  originalMesh: MeshData,
  results: AnalysisResults,
  wasDecimated: boolean,
  originalTriangleCount: number
): MeshStats {
  return {
    vertexCount: originalMesh.vertexCount,
    triangleCount: originalMesh.triangleCount,
    edgeCount: results.edgeCount,
    componentCount: results.components.componentCount,
    boundingBox: originalMesh.boundingBox,
    analysisDecimated: wasDecimated,
    originalTriangleCount: wasDecimated ? originalTriangleCount : undefined,
  }
}

/**
 * Generates a complete printability report for a mesh.
 *
 * If the mesh exceeds maxTrianglesForAnalysis, it will be decimated
 * for analysis purposes only. The original mesh stats are preserved.
 *
 * @param mesh - The mesh data to analyze
 * @param profile - Printer profile with analysis settings (defaults to DEFAULT_PRINTER_PROFILE)
 * @returns PrintabilityReport with analysis results
 */
export function generateReport(
  mesh: MeshData,
  profile: PrinterProfile = DEFAULT_PRINTER_PROFILE
): PrintabilityReport {
  // Decimate mesh if necessary for analysis
  const decimationResult = decimateForAnalysis(mesh, profile.maxTrianglesForAnalysis)
  const analysisTarget = decimationResult.mesh

  // Run all analysis on (potentially decimated) mesh
  const results = runAllAnalysis(analysisTarget, profile)

  // Generate issues
  const issues = generateIssues(results)

  // Determine status
  const status = determineStatus(issues)

  // Create mesh stats (using original mesh dimensions)
  const meshStats = createMeshStats(
    mesh,
    results,
    decimationResult.wasDecimated,
    decimationResult.originalTriangleCount
  )

  // Create overlay data
  const overlayData = createOverlayData(results)

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    toolVersions: TOOL_VERSIONS,
    meshStats,
    printerProfile: profile,
    status,
    issues,
    overlayData,
  }
}
