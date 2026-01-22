import { describe, it, expect } from 'vitest'
import { generateFixPlan } from '@/lib/repair/fixPlanGenerator'
import type { PrintabilityReport } from '@/types/report'
import { FIX_PLAN_SCHEMA_VERSION } from '@/types/fixPlan'

describe('fixPlanGenerator', () => {
  const createBaseReport = (overrides: Partial<PrintabilityReport> = {}): PrintabilityReport => ({
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    meshId: 'test-mesh',
    overall: 'pass',
    issues: [],
    checks: {
      watertight: { status: 'pass', boundaryEdgeCount: 0, nonManifoldEdgeCount: 0 },
      components: { status: 'pass', componentCount: 1, isMultiComponent: false },
      scale: { status: 'pass', dimensions: [100, 100, 100], isValidSize: true, unit: 'mm' },
      overhang: { status: 'pass', overhangFaceCount: 0, overhangPercentage: 0, threshold: 45 },
    },
    ...overrides,
  })

  describe('basic generation', () => {
    it('should generate fix plan with correct schema version', () => {
      const report = createBaseReport()
      const plan = generateFixPlan(report, 'test-mesh')

      expect(plan.schemaVersion).toBe(FIX_PLAN_SCHEMA_VERSION)
    })

    it('should include mesh ID and report ID', () => {
      const report = createBaseReport()
      const plan = generateFixPlan(report, 'mesh-123')

      expect(plan.meshId).toBe('mesh-123')
      expect(plan.reportId).toBe('mesh-123')
    })

    it('should include timestamp', () => {
      const report = createBaseReport()
      const plan = generateFixPlan(report, 'test-mesh')

      expect(plan.createdAt).toBeDefined()
      expect(new Date(plan.createdAt).getTime()).not.toBeNaN()
    })

    it('should return empty arrays for report with no issues', () => {
      const report = createBaseReport()
      const plan = generateFixPlan(report, 'test-mesh')

      expect(plan.recommended).toEqual([])
      expect(plan.advisory).toEqual([])
    })
  })

  describe('floater removal recipe', () => {
    it('should generate remove floaters recipe for floater issue', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'floater_components',
            severity: 'warn',
            message: 'Multiple components detected',
            details: { floaterCount: 3, floaterFaceCount: 150 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      const floaterRecipe = plan.recommended.find((r) => r.type === 'remove_floaters')
      expect(floaterRecipe).toBeDefined()
      expect(floaterRecipe?.implemented).toBe(true)
      expect(floaterRecipe?.risk).toBe('LOW')
      expect(floaterRecipe?.description).toContain('3')
      expect(floaterRecipe?.description).toContain('150')
    })
  })

  describe('mesh cleanup recipe', () => {
    it('should generate mesh cleanup recipe when issues exist', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'boundary_edges',
            severity: 'warn',
            message: 'Open edges detected',
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      const cleanupRecipe = plan.recommended.find((r) => r.type === 'mesh_cleanup')
      expect(cleanupRecipe).toBeDefined()
      expect(cleanupRecipe?.implemented).toBe(true)
      expect(cleanupRecipe?.risk).toBe('LOW')
    })

    it('should not generate mesh cleanup for report with no issues', () => {
      const report = createBaseReport() // No issues
      const plan = generateFixPlan(report, 'test-mesh')

      const cleanupRecipe = plan.recommended.find((r) => r.type === 'mesh_cleanup')
      expect(cleanupRecipe).toBeUndefined()
    })
  })

  describe('auto orient recipe', () => {
    it('should generate auto orient recipe for overhang issue', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'overhang',
            severity: 'warn',
            message: 'High overhang detected',
            details: { overhangPercentage: 45.5 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      const orientRecipe = plan.recommended.find((r) => r.type === 'auto_orient')
      expect(orientRecipe).toBeDefined()
      expect(orientRecipe?.implemented).toBe(true)
      expect(orientRecipe?.risk).toBe('LOW')
      expect(orientRecipe?.description).toContain('45.5%')
    })
  })

  describe('watertight remesh recipe', () => {
    it('should generate watertight remesh as recommended for boundary edges', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'boundary_edges',
            severity: 'fail',
            message: 'Open edges detected',
            details: { boundaryEdgeCount: 12 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      const remeshRecipe = plan.recommended.find((r) => r.type === 'watertight_remesh')
      expect(remeshRecipe).toBeDefined()
      expect(remeshRecipe?.implemented).toBe(true)
      expect(remeshRecipe?.risk).toBe('HIGH')
      expect(remeshRecipe?.description).toContain('12')
    })

    it('should not generate watertight remesh for non-manifold edges only', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'non_manifold_edges',
            severity: 'fail',
            message: 'Non-manifold geometry detected',
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      // Watertight remesh only handles boundary edges, not non-manifold
      const remeshRecipe = plan.recommended.find((r) => r.type === 'watertight_remesh')
      expect(remeshRecipe).toBeUndefined()
    })
  })

  describe('recipe sorting', () => {
    it('should sort recommended recipes by risk (LOW first)', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'floater_components',
            severity: 'warn',
            message: 'Floaters',
            details: { floaterCount: 1, floaterFaceCount: 10 },
          },
          {
            id: 'issue-2',
            type: 'overhang',
            severity: 'warn',
            message: 'Overhang',
            details: { overhangPercentage: 30 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      // All recommended should be LOW risk
      for (const recipe of plan.recommended) {
        expect(['LOW', 'MEDIUM']).toContain(recipe.risk)
      }

      // First recipe should be LOW risk
      expect(plan.recommended[0]?.risk).toBe('LOW')
    })

    it('should place HIGH risk recipes last in recommended', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'boundary_edges',
            severity: 'fail',
            message: 'Open edges',
            details: { boundaryEdgeCount: 5 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      // Recommended should have HIGH risk watertight remesh (sorted last)
      const hasHighRisk = plan.recommended.some((r) => r.risk === 'HIGH')
      expect(hasHighRisk).toBe(true)

      // HIGH risk should be last
      const highRiskRecipe = plan.recommended.find((r) => r.risk === 'HIGH')
      const lastRecipe = plan.recommended[plan.recommended.length - 1]
      expect(lastRecipe?.risk).toBe('HIGH')
    })
  })

  describe('recipe properties', () => {
    it('should include target issues in recipes', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'floater-issue-123',
            type: 'floater_components',
            severity: 'warn',
            message: 'Floaters',
            details: { floaterCount: 1, floaterFaceCount: 10 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')
      const recipe = plan.recommended.find((r) => r.type === 'remove_floaters')

      expect(recipe?.targetIssues).toContain('floater-issue-123')
    })

    it('should include steps in recipes', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'floater_components',
            severity: 'warn',
            message: 'Floaters',
            details: { floaterCount: 1, floaterFaceCount: 10 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')
      const recipe = plan.recommended.find((r) => r.type === 'remove_floaters')

      expect(recipe?.steps.length).toBeGreaterThan(0)
      expect(recipe?.steps[0].op).toBeDefined()
    })

    it('should include warnings in recipes', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'floater_components',
            severity: 'warn',
            message: 'Floaters',
            details: { floaterCount: 1, floaterFaceCount: 10 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')
      const recipe = plan.recommended.find((r) => r.type === 'remove_floaters')

      expect(recipe?.warnings.length).toBeGreaterThan(0)
    })

    it('should include unique IDs', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'floater_components',
            severity: 'warn',
            message: 'Floaters',
            details: { floaterCount: 1, floaterFaceCount: 10 },
          },
          {
            id: 'issue-2',
            type: 'overhang',
            severity: 'warn',
            message: 'Overhang',
            details: { overhangPercentage: 30 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')
      const ids = plan.recommended.map((r) => r.id)

      // All IDs should be unique
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('complex scenarios', () => {
    it('should handle multiple issues of different types', () => {
      const report = createBaseReport({
        issues: [
          {
            id: 'issue-1',
            type: 'floater_components',
            severity: 'warn',
            message: 'Floaters',
            details: { floaterCount: 2, floaterFaceCount: 50 },
          },
          {
            id: 'issue-2',
            type: 'overhang',
            severity: 'warn',
            message: 'Overhang',
            details: { overhangPercentage: 35 },
          },
          {
            id: 'issue-3',
            type: 'boundary_edges',
            severity: 'fail',
            message: 'Open edges',
            details: { boundaryEdgeCount: 8 },
          },
        ],
      })

      const plan = generateFixPlan(report, 'test-mesh')

      // Should have floater removal
      expect(plan.recommended.some((r) => r.type === 'remove_floaters')).toBe(true)

      // Should have auto orient
      expect(plan.recommended.some((r) => r.type === 'auto_orient')).toBe(true)

      // Should have mesh cleanup
      expect(plan.recommended.some((r) => r.type === 'mesh_cleanup')).toBe(true)

      // Should have watertight remesh in recommended (now implemented)
      expect(plan.recommended.some((r) => r.type === 'watertight_remesh')).toBe(true)
    })
  })
})
