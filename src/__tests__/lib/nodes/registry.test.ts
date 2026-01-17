import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerNode,
  getNodeComponent,
  getNodeDefinition,
  getAllNodeTypes,
  isValidConnection,
  meshSourceDefinition,
  printabilityReportDefinition,
  suggestedFixesDefinition,
} from '@/lib/nodes/registry'

// Import to register nodes
import '@/components/nodes'

describe('Node Registry', () => {
  describe('getNodeDefinition', () => {
    it('returns mesh-source definition', () => {
      const def = getNodeDefinition('mesh-source')
      expect(def).toBeDefined()
      expect(def?.label).toBe('Mesh Source')
      expect(def?.inputs).toHaveLength(0)
      expect(def?.outputs).toHaveLength(1)
      expect(def?.outputs[0].type).toBe('mesh')
    })

    it('returns printability-report definition', () => {
      const def = getNodeDefinition('printability-report')
      expect(def).toBeDefined()
      expect(def?.label).toBe('Printability Report')
      expect(def?.inputs).toHaveLength(1)
      expect(def?.inputs[0].type).toBe('mesh')
      expect(def?.outputs).toHaveLength(1)
      expect(def?.outputs[0].type).toBe('report')
    })

    it('returns suggested-fixes definition', () => {
      const def = getNodeDefinition('suggested-fixes')
      expect(def).toBeDefined()
      expect(def?.label).toBe('Suggested Fixes')
      expect(def?.inputs).toHaveLength(2)
      expect(def?.outputs).toHaveLength(1)
      expect(def?.outputs[0].type).toBe('mesh')
    })

    it('returns undefined for unknown type', () => {
      const def = getNodeDefinition('unknown-type')
      expect(def).toBeUndefined()
    })
  })

  describe('getNodeComponent', () => {
    it('returns component for mesh-source', () => {
      const component = getNodeComponent('mesh-source')
      expect(component).toBeDefined()
      expect(typeof component).toBe('function')
    })

    it('returns component for printability-report', () => {
      const component = getNodeComponent('printability-report')
      expect(component).toBeDefined()
    })

    it('returns component for suggested-fixes', () => {
      const component = getNodeComponent('suggested-fixes')
      expect(component).toBeDefined()
    })

    it('returns undefined for unknown type', () => {
      const component = getNodeComponent('unknown-type')
      expect(component).toBeUndefined()
    })
  })

  describe('getAllNodeTypes', () => {
    it('returns all registered node types', () => {
      const types = getAllNodeTypes()
      expect(types.length).toBeGreaterThanOrEqual(3)
      expect(types.some((t) => t.type === 'mesh-source')).toBe(true)
      expect(types.some((t) => t.type === 'printability-report')).toBe(true)
      expect(types.some((t) => t.type === 'suggested-fixes')).toBe(true)
    })
  })

  describe('isValidConnection', () => {
    it('allows mesh-source to printability-report (mesh -> mesh)', () => {
      const valid = isValidConnection(
        'mesh-source',
        'mesh',
        'printability-report',
        'mesh'
      )
      expect(valid).toBe(true)
    })

    it('allows printability-report to suggested-fixes (report -> report)', () => {
      const valid = isValidConnection(
        'printability-report',
        'report',
        'suggested-fixes',
        'report'
      )
      expect(valid).toBe(true)
    })

    it('allows mesh-source to suggested-fixes (mesh -> mesh)', () => {
      const valid = isValidConnection(
        'mesh-source',
        'mesh',
        'suggested-fixes',
        'mesh'
      )
      expect(valid).toBe(true)
    })

    it('rejects mismatched types (mesh -> report)', () => {
      const valid = isValidConnection(
        'mesh-source',
        'mesh',
        'suggested-fixes',
        'report'
      )
      expect(valid).toBe(false)
    })

    it('rejects unknown source node type', () => {
      const valid = isValidConnection(
        'unknown',
        'mesh',
        'printability-report',
        'mesh'
      )
      expect(valid).toBe(false)
    })

    it('rejects unknown target node type', () => {
      const valid = isValidConnection(
        'mesh-source',
        'mesh',
        'unknown',
        'mesh'
      )
      expect(valid).toBe(false)
    })

    it('rejects unknown source handle', () => {
      const valid = isValidConnection(
        'mesh-source',
        'unknown-handle',
        'printability-report',
        'mesh'
      )
      expect(valid).toBe(false)
    })

    it('rejects unknown target handle', () => {
      const valid = isValidConnection(
        'mesh-source',
        'mesh',
        'printability-report',
        'unknown-handle'
      )
      expect(valid).toBe(false)
    })
  })
})

describe('Node Type Definitions', () => {
  it('meshSourceDefinition has correct structure', () => {
    expect(meshSourceDefinition.type).toBe('mesh-source')
    expect(meshSourceDefinition.inputs).toEqual([])
    expect(meshSourceDefinition.outputs[0]).toEqual({
      id: 'mesh',
      label: 'Mesh',
      type: 'mesh',
    })
  })

  it('printabilityReportDefinition has correct structure', () => {
    expect(printabilityReportDefinition.type).toBe('printability-report')
    expect(printabilityReportDefinition.inputs[0].type).toBe('mesh')
    expect(printabilityReportDefinition.outputs[0].type).toBe('report')
  })

  it('suggestedFixesDefinition has correct structure', () => {
    expect(suggestedFixesDefinition.type).toBe('suggested-fixes')
    expect(suggestedFixesDefinition.inputs).toHaveLength(2)
    expect(suggestedFixesDefinition.inputs.map((i) => i.type)).toContain('mesh')
    expect(suggestedFixesDefinition.inputs.map((i) => i.type)).toContain('report')
    expect(suggestedFixesDefinition.outputs[0].type).toBe('mesh')
  })
})
