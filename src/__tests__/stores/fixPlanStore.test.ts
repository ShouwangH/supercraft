import { describe, it, expect, beforeEach } from 'vitest'
import { useFixPlanStore } from '@/stores/fixPlanStore'
import type { FixPlan } from '@/types/fixPlan'

describe('fixPlanStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useFixPlanStore.getState().clearPlans()
  })

  const createMockPlan = (meshId: string): FixPlan => ({
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    meshId,
    reportId: `report-${meshId}`,
    recommended: [
      {
        id: 'recipe-1',
        type: 'remove_floaters',
        title: 'Remove Floaters',
        description: 'Remove small disconnected components',
        targetIssues: ['multiple_components'],
        risk: 'LOW',
        shapeImpact: 'LOCAL',
        deterministic: true,
        implemented: true,
        steps: [],
        warnings: [],
        expectedEffect: 'Removes small components',
      },
    ],
    advisory: [
      {
        id: 'recipe-2',
        type: 'watertight_remesh',
        title: 'Watertight Remesh',
        description: 'Create watertight mesh',
        targetIssues: ['non_watertight'],
        risk: 'HIGH',
        shapeImpact: 'GLOBAL',
        deterministic: false,
        implemented: false,
        steps: [],
        warnings: ['May alter surface details'],
        expectedEffect: 'Creates watertight mesh',
      },
    ],
  })

  describe('setPlan', () => {
    it('should set a fix plan for a mesh', () => {
      const plan = createMockPlan('mesh-1')
      useFixPlanStore.getState().setPlan('mesh-1', plan)

      const storedPlan = useFixPlanStore.getState().getPlan('mesh-1')
      expect(storedPlan).toEqual(plan)
    })

    it('should clear error when setting plan', () => {
      useFixPlanStore.getState().setError('mesh-1', 'Some error')
      expect(useFixPlanStore.getState().errors['mesh-1']).toBe('Some error')

      const plan = createMockPlan('mesh-1')
      useFixPlanStore.getState().setPlan('mesh-1', plan)

      expect(useFixPlanStore.getState().errors['mesh-1']).toBeUndefined()
    })

    it('should overwrite existing plan', () => {
      const plan1 = createMockPlan('mesh-1')
      const plan2 = createMockPlan('mesh-1')
      plan2.recommended = []

      useFixPlanStore.getState().setPlan('mesh-1', plan1)
      useFixPlanStore.getState().setPlan('mesh-1', plan2)

      const storedPlan = useFixPlanStore.getState().getPlan('mesh-1')
      expect(storedPlan?.recommended).toEqual([])
    })
  })

  describe('getPlan', () => {
    it('should return undefined for non-existent plan', () => {
      const plan = useFixPlanStore.getState().getPlan('non-existent')
      expect(plan).toBeUndefined()
    })

    it('should return the correct plan', () => {
      const plan1 = createMockPlan('mesh-1')
      const plan2 = createMockPlan('mesh-2')

      useFixPlanStore.getState().setPlan('mesh-1', plan1)
      useFixPlanStore.getState().setPlan('mesh-2', plan2)

      expect(useFixPlanStore.getState().getPlan('mesh-1')?.meshId).toBe('mesh-1')
      expect(useFixPlanStore.getState().getPlan('mesh-2')?.meshId).toBe('mesh-2')
    })
  })

  describe('removePlan', () => {
    it('should remove a plan', () => {
      const plan = createMockPlan('mesh-1')
      useFixPlanStore.getState().setPlan('mesh-1', plan)
      expect(useFixPlanStore.getState().getPlan('mesh-1')).toBeDefined()

      useFixPlanStore.getState().removePlan('mesh-1')
      expect(useFixPlanStore.getState().getPlan('mesh-1')).toBeUndefined()
    })

    it('should clear related state when removing plan', () => {
      const plan = createMockPlan('mesh-1')
      useFixPlanStore.getState().setPlan('mesh-1', plan)
      useFixPlanStore.getState().setGenerating('mesh-1', true)
      useFixPlanStore.getState().setApplyingFix('mesh-1', 'recipe-1')
      useFixPlanStore.getState().setError('mesh-1', 'Error')
      useFixPlanStore.getState().setActivePlan('mesh-1')

      useFixPlanStore.getState().removePlan('mesh-1')

      expect(useFixPlanStore.getState().generating['mesh-1']).toBeUndefined()
      expect(useFixPlanStore.getState().applyingFix['mesh-1']).toBeUndefined()
      expect(useFixPlanStore.getState().errors['mesh-1']).toBeUndefined()
      expect(useFixPlanStore.getState().activePlanId).toBeNull()
    })

    it('should not clear activePlanId if removing different mesh', () => {
      const plan1 = createMockPlan('mesh-1')
      const plan2 = createMockPlan('mesh-2')
      useFixPlanStore.getState().setPlan('mesh-1', plan1)
      useFixPlanStore.getState().setPlan('mesh-2', plan2)
      useFixPlanStore.getState().setActivePlan('mesh-2')

      useFixPlanStore.getState().removePlan('mesh-1')

      expect(useFixPlanStore.getState().activePlanId).toBe('mesh-2')
    })
  })

  describe('setActivePlan', () => {
    it('should set the active plan ID', () => {
      useFixPlanStore.getState().setActivePlan('mesh-1')
      expect(useFixPlanStore.getState().activePlanId).toBe('mesh-1')
    })

    it('should allow setting to null', () => {
      useFixPlanStore.getState().setActivePlan('mesh-1')
      useFixPlanStore.getState().setActivePlan(null)
      expect(useFixPlanStore.getState().activePlanId).toBeNull()
    })
  })

  describe('setGenerating', () => {
    it('should set generating state', () => {
      useFixPlanStore.getState().setGenerating('mesh-1', true)
      expect(useFixPlanStore.getState().generating['mesh-1']).toBe(true)

      useFixPlanStore.getState().setGenerating('mesh-1', false)
      expect(useFixPlanStore.getState().generating['mesh-1']).toBe(false)
    })

    it('should track generating state per mesh', () => {
      useFixPlanStore.getState().setGenerating('mesh-1', true)
      useFixPlanStore.getState().setGenerating('mesh-2', false)

      expect(useFixPlanStore.getState().generating['mesh-1']).toBe(true)
      expect(useFixPlanStore.getState().generating['mesh-2']).toBe(false)
    })
  })

  describe('setApplyingFix', () => {
    it('should set the applying fix recipe ID', () => {
      useFixPlanStore.getState().setApplyingFix('mesh-1', 'recipe-1')
      expect(useFixPlanStore.getState().applyingFix['mesh-1']).toBe('recipe-1')
    })

    it('should allow setting to null', () => {
      useFixPlanStore.getState().setApplyingFix('mesh-1', 'recipe-1')
      useFixPlanStore.getState().setApplyingFix('mesh-1', null)
      expect(useFixPlanStore.getState().applyingFix['mesh-1']).toBeNull()
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      useFixPlanStore.getState().setError('mesh-1', 'Something went wrong')
      expect(useFixPlanStore.getState().errors['mesh-1']).toBe('Something went wrong')
    })

    it('should remove error when set to null', () => {
      useFixPlanStore.getState().setError('mesh-1', 'Error')
      useFixPlanStore.getState().setError('mesh-1', null)
      expect(useFixPlanStore.getState().errors['mesh-1']).toBeUndefined()
    })
  })

  describe('clearPlans', () => {
    it('should clear all state', () => {
      const plan = createMockPlan('mesh-1')
      useFixPlanStore.getState().setPlan('mesh-1', plan)
      useFixPlanStore.getState().setActivePlan('mesh-1')
      useFixPlanStore.getState().setGenerating('mesh-1', true)
      useFixPlanStore.getState().setApplyingFix('mesh-1', 'recipe-1')
      useFixPlanStore.getState().setError('mesh-1', 'Error')

      useFixPlanStore.getState().clearPlans()

      expect(useFixPlanStore.getState().plans).toEqual({})
      expect(useFixPlanStore.getState().activePlanId).toBeNull()
      expect(useFixPlanStore.getState().generating).toEqual({})
      expect(useFixPlanStore.getState().applyingFix).toEqual({})
      expect(useFixPlanStore.getState().errors).toEqual({})
    })
  })
})
