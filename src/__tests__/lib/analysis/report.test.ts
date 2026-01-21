import { describe, it, expect } from 'vitest'
import { generateReport, runAllAnalysis } from '@/lib/analysis/report'
import type { MeshData } from '@/types/mesh'
import { REPORT_SCHEMA_VERSION, DEFAULT_PRINTER_PROFILE, TOOL_VERSIONS } from '@/types/report'

// Helper to create a valid closed cube mesh (10mm x 10mm x 10mm to avoid scale warnings)
function createClosedCubeMesh(): MeshData {
  const positions = new Float32Array([
    // Bottom face (y = 0)
    0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10,
    // Top face (y = 10)
    0, 10, 0, 10, 10, 0, 10, 10, 10, 0, 10, 10,
  ])
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom
    4, 5, 6, 4, 6, 7, // Top
    3, 6, 2, 3, 7, 6, // Front
    0, 1, 5, 0, 5, 4, // Back
    0, 4, 7, 0, 7, 3, // Left
    1, 2, 6, 1, 6, 5, // Right
  ])

  return {
    id: 'test-cube',
    name: 'Test Cube',
    positions,
    indices,
    normals: new Float32Array(positions.length), // Will be computed
    vertexCount: 8,
    triangleCount: 12,
    boundingBox: {
      min: [0, 0, 0],
      max: [10, 10, 10],
      dimensions: [10, 10, 10],
    },
  }
}

// Helper to create an open box (missing top face) - 10mm scale
function createOpenBoxMesh(): MeshData {
  const positions = new Float32Array([
    0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10,
    0, 10, 0, 10, 10, 0, 10, 10, 10, 0, 10, 10,
  ])
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom
    3, 6, 2, 3, 7, 6, // Front
    0, 1, 5, 0, 5, 4, // Back
    0, 4, 7, 0, 7, 3, // Left
    1, 2, 6, 1, 6, 5, // Right
    // Top OMITTED - creates boundary edges
  ])

  return {
    id: 'test-open-box',
    name: 'Test Open Box',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 8,
    triangleCount: 10,
    boundingBox: {
      min: [0, 0, 0],
      max: [10, 10, 10],
      dimensions: [10, 10, 10],
    },
  }
}

// Helper to create mesh with floaters - 10mm main cube + tiny disconnected triangles
function createMeshWithFloaters(): MeshData {
  // Main cube (10mm) + 2 tiny disconnected triangles
  const positions = new Float32Array([
    // Main cube (8 vertices) - 10mm x 10mm x 10mm
    0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10,
    0, 10, 0, 10, 10, 0, 10, 10, 10, 0, 10, 10,
    // Floater 1 (3 vertices) - small triangle at x=50
    50, 0, 0, 51, 0, 0, 50.5, 1, 0,
    // Floater 2 (3 vertices) - small triangle at x=-50
    -50, 0, 0, -49, 0, 0, -49.5, 1, 0,
  ])

  const cubeIndices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    3, 6, 2, 3, 7, 6,
    0, 1, 5, 0, 5, 4,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
  ]

  const indices = new Uint32Array([
    ...cubeIndices,
    8, 9, 10, // Floater 1
    11, 12, 13, // Floater 2
  ])

  return {
    id: 'test-floaters',
    name: 'Test Floaters',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 14,
    triangleCount: 14,
    boundingBox: {
      min: [-50, 0, 0],
      max: [51, 10, 10],
      dimensions: [101, 10, 10],
    },
  }
}

// Helper to create non-manifold mesh - 10mm scale
function createNonManifoldMesh(): MeshData {
  // 3 triangles sharing edge 0-1
  const positions = new Float32Array([
    0, 0, 0, // 0
    10, 0, 0, // 1
    5, 10, 0, // 2
    5, 0, 10, // 3
    5, 0, -10, // 4
  ])
  const indices = new Uint32Array([
    0, 1, 2,
    0, 1, 3,
    0, 1, 4,
  ])

  return {
    id: 'test-non-manifold',
    name: 'Test Non-Manifold',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 5,
    triangleCount: 3,
    boundingBox: {
      min: [0, 0, -10],
      max: [10, 10, 10],
      dimensions: [10, 10, 20],
    },
  }
}

describe('report', () => {
  describe('generateReport', () => {
    it('generates report with correct schema version', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION)
    })

    it('includes created timestamp', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.createdAt).toBeDefined()
      // Should be a valid ISO date string
      expect(() => new Date(report.createdAt)).not.toThrow()
    })

    it('includes tool versions for traceability', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.toolVersions).toEqual(TOOL_VERSIONS)
      expect(report.toolVersions.app).toBeDefined()
      expect(report.toolVersions.three).toBeDefined()
      expect(report.toolVersions.reactFlow).toBeDefined()
    })

    it('includes mesh stats', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.meshStats.vertexCount).toBe(8)
      expect(report.meshStats.triangleCount).toBe(12)
      expect(report.meshStats.boundingBox).toEqual(mesh.boundingBox)
    })

    it('includes printer profile', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.printerProfile).toEqual(DEFAULT_PRINTER_PROFILE)
    })

    it('uses custom printer profile when provided', () => {
      const mesh = createClosedCubeMesh()
      const customProfile = {
        ...DEFAULT_PRINTER_PROFILE,
        overhangThresholdDeg: 30,
      }
      const report = generateReport(mesh, customProfile)

      expect(report.printerProfile.overhangThresholdDeg).toBe(30)
    })

    it('returns PASS status for valid closed cube', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.status).toBe('PASS')
      // No blockers for a clean mesh
      expect(report.issues.filter((i) => i.severity === 'BLOCKER')).toHaveLength(0)
    })

    it('returns FAIL status for open box (boundary edges)', () => {
      const mesh = createOpenBoxMesh()
      const report = generateReport(mesh)

      expect(report.status).toBe('FAIL')

      const boundaryIssue = report.issues.find((i) => i.type === 'boundary_edges')
      expect(boundaryIssue).toBeDefined()
      expect(boundaryIssue!.severity).toBe('BLOCKER')
    })

    it('returns FAIL status for non-manifold mesh', () => {
      const mesh = createNonManifoldMesh()
      const report = generateReport(mesh)

      expect(report.status).toBe('FAIL')

      const nmIssue = report.issues.find((i) => i.type === 'non_manifold_edges')
      expect(nmIssue).toBeDefined()
      expect(nmIssue!.severity).toBe('BLOCKER')
    })

    it('reports floater components as RISK', () => {
      const mesh = createMeshWithFloaters()
      // Use a 10% threshold so 1-face components (14 faces total, 10% = 1.4, ceil = 2)
      // are considered floaters since their size (1) < threshold (2)
      const customProfile = {
        ...DEFAULT_PRINTER_PROFILE,
        floaterThresholdPercent: 10,
      }
      const report = generateReport(mesh, customProfile)

      const floaterIssue = report.issues.find((i) => i.type === 'floater_components')
      expect(floaterIssue).toBeDefined()
      expect(floaterIssue!.severity).toBe('RISK')
    })

    it('sorts issues by severity (BLOCKER first)', () => {
      // Create mesh that has both blocker and risk issues
      const mesh = createOpenBoxMesh() // Has boundary edges (BLOCKER)
      const report = generateReport(mesh)

      if (report.issues.length >= 2) {
        // First issue should be BLOCKER if any exist
        const blockerIdx = report.issues.findIndex((i) => i.severity === 'BLOCKER')
        const riskIdx = report.issues.findIndex((i) => i.severity === 'RISK')

        if (blockerIdx !== -1 && riskIdx !== -1) {
          expect(blockerIdx).toBeLessThan(riskIdx)
        }
      }
    })

    it('includes overlay data', () => {
      const mesh = createOpenBoxMesh()
      const report = generateReport(mesh)

      expect(report.overlayData).toBeDefined()
      expect(report.overlayData.boundaryEdges).toBeDefined()
      expect(report.overlayData.boundaryEdges!.length).toBeGreaterThan(0)
    })

    it('includes component overlay data', () => {
      const mesh = createClosedCubeMesh()
      const report = generateReport(mesh)

      expect(report.overlayData.componentIdPerFace).toBeDefined()
      expect(report.overlayData.mainComponentIndex).toBeDefined()
    })
  })

  describe('runAllAnalysis', () => {
    it('returns results from all analysis checks', () => {
      const mesh = createClosedCubeMesh()
      const results = runAllAnalysis(mesh, DEFAULT_PRINTER_PROFILE)

      expect(results.watertight).toBeDefined()
      expect(results.nonManifold).toBeDefined()
      expect(results.components).toBeDefined()
      expect(results.overhang).toBeDefined()
      expect(results.scale).toBeDefined()
      expect(results.edgeCount).toBeGreaterThan(0)
    })

    it('detects boundary edges in open mesh', () => {
      const mesh = createOpenBoxMesh()
      const results = runAllAnalysis(mesh, DEFAULT_PRINTER_PROFILE)

      expect(results.watertight.isWatertight).toBe(false)
      expect(results.watertight.boundaryEdgeCount).toBe(4)
    })

    it('detects non-manifold edges', () => {
      const mesh = createNonManifoldMesh()
      const results = runAllAnalysis(mesh, DEFAULT_PRINTER_PROFILE)

      expect(results.nonManifold.hasNonManifold).toBe(true)
      expect(results.nonManifold.nonManifoldEdgeCount).toBeGreaterThan(0)
    })
  })
})
