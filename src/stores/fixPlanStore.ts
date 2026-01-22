/**
 * Fix Plan Store
 *
 * Manages fix plans for mesh repair operations.
 */

import { create } from 'zustand'
import type { FixPlan } from '@/types/fixPlan'

export interface FixPlanState {
  /** Fix plans keyed by mesh ID */
  plans: Record<string, FixPlan>
  /** Currently active fix plan ID (mesh ID) */
  activePlanId: string | null
  /** Loading state for plan generation */
  generating: Record<string, boolean>
  /** Loading state for fix application */
  applyingFix: Record<string, string | null>
  /** Error messages keyed by mesh ID */
  errors: Record<string, string>

  /** Set a fix plan for a mesh */
  setPlan: (meshId: string, plan: FixPlan) => void
  /** Remove a fix plan */
  removePlan: (meshId: string) => void
  /** Set the active fix plan */
  setActivePlan: (meshId: string | null) => void
  /** Set generating state for a mesh */
  setGenerating: (meshId: string, generating: boolean) => void
  /** Set applying fix state for a mesh */
  setApplyingFix: (meshId: string, recipeId: string | null) => void
  /** Set error for a mesh */
  setError: (meshId: string, error: string | null) => void
  /** Get fix plan for a mesh */
  getPlan: (meshId: string) => FixPlan | undefined
  /** Clear all fix plans */
  clearPlans: () => void
}

export const useFixPlanStore = create<FixPlanState>((set, get) => ({
  plans: {},
  activePlanId: null,
  generating: {},
  applyingFix: {},
  errors: {},

  setPlan: (meshId, plan) =>
    set((state) => ({
      plans: { ...state.plans, [meshId]: plan },
      errors: { ...state.errors, [meshId]: undefined } as Record<string, string>,
    })),

  removePlan: (meshId) =>
    set((state) => {
      const { [meshId]: removed, ...rest } = state.plans
      const { [meshId]: removedGenerating, ...restGenerating } = state.generating
      const { [meshId]: removedApplying, ...restApplying } = state.applyingFix
      const { [meshId]: removedError, ...restErrors } = state.errors
      return {
        plans: rest,
        generating: restGenerating,
        applyingFix: restApplying,
        errors: restErrors,
        activePlanId: state.activePlanId === meshId ? null : state.activePlanId,
      }
    }),

  setActivePlan: (meshId) => set({ activePlanId: meshId }),

  setGenerating: (meshId, generating) =>
    set((state) => ({
      generating: { ...state.generating, [meshId]: generating },
    })),

  setApplyingFix: (meshId, recipeId) =>
    set((state) => ({
      applyingFix: { ...state.applyingFix, [meshId]: recipeId },
    })),

  setError: (meshId, error) =>
    set((state) => ({
      errors: error
        ? { ...state.errors, [meshId]: error }
        : (({ [meshId]: _, ...rest }) => rest)(state.errors) as Record<string, string>,
    })),

  getPlan: (meshId) => get().plans[meshId],

  clearPlans: () =>
    set({
      plans: {},
      activePlanId: null,
      generating: {},
      applyingFix: {},
      errors: {},
    }),
}))
