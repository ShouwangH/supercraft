import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { NodeCanvas, createInitialNodes } from '@/components/canvas/NodeCanvas'

describe('NodeCanvas', () => {
  it('renders without crashing', () => {
    const { container } = render(<NodeCanvas />)
    expect(container).toBeDefined()
  })

  it('renders with initial nodes', () => {
    const { nodes, edges } = createInitialNodes()
    const { container } = render(
      <NodeCanvas initialNodes={nodes} initialEdges={edges} />
    )
    expect(container).toBeDefined()
  })
})

describe('createInitialNodes', () => {
  it('returns expected node structure', () => {
    const { nodes, edges } = createInitialNodes()

    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(3)
  })

  it('creates mesh-source node', () => {
    const { nodes } = createInitialNodes()
    const meshSource = nodes.find((n) => n.type === 'mesh-source')

    expect(meshSource).toBeDefined()
    expect(meshSource?.data.label).toBe('Mesh Source')
    expect(meshSource?.data.status).toBe('idle')
  })

  it('creates printability-report node', () => {
    const { nodes } = createInitialNodes()
    const report = nodes.find((n) => n.type === 'printability-report')

    expect(report).toBeDefined()
    expect(report?.data.label).toBe('Printability Report')
    expect(report?.data.status).toBe('idle')
  })

  it('creates suggested-fixes node', () => {
    const { nodes } = createInitialNodes()
    const fixes = nodes.find((n) => n.type === 'suggested-fixes')

    expect(fixes).toBeDefined()
    expect(fixes?.data.label).toBe('Suggested Fixes')
    expect(fixes?.data.status).toBe('idle')
  })

  it('creates edges connecting nodes correctly', () => {
    const { edges } = createInitialNodes()

    // Mesh source -> Printability report (mesh)
    const e1 = edges.find((e) => e.source === 'mesh-source-1' && e.target === 'printability-report-1')
    expect(e1).toBeDefined()
    expect(e1?.sourceHandle).toBe('mesh')
    expect(e1?.targetHandle).toBe('mesh')

    // Mesh source -> Suggested fixes (mesh)
    const e2 = edges.find((e) => e.source === 'mesh-source-1' && e.target === 'suggested-fixes-1')
    expect(e2).toBeDefined()
    expect(e2?.sourceHandle).toBe('mesh')
    expect(e2?.targetHandle).toBe('mesh')

    // Printability report -> Suggested fixes (report)
    const e3 = edges.find((e) => e.source === 'printability-report-1' && e.target === 'suggested-fixes-1')
    expect(e3).toBeDefined()
    expect(e3?.sourceHandle).toBe('report')
    expect(e3?.targetHandle).toBe('report')
  })
})
