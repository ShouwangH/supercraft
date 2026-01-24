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
  it('returns only mesh-source node initially', () => {
    const { nodes, edges } = createInitialNodes()

    // Only MeshSourceNode at start - other nodes created dynamically
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('creates mesh-source node', () => {
    const { nodes } = createInitialNodes()
    const meshSource = nodes.find((n) => n.type === 'mesh-source')

    expect(meshSource).toBeDefined()
    expect(meshSource?.data.label).toBe('Mesh Source')
    expect(meshSource?.data.status).toBe('idle')
  })

  it('mesh-source node has correct initial data', () => {
    const { nodes } = createInitialNodes()
    const meshSource = nodes[0]

    expect(meshSource.id).toBe('mesh-source-1')
    expect(meshSource.type).toBe('mesh-source')
    expect(meshSource.data.meshId).toBeNull()
    expect(meshSource.data.meshName).toBeNull()
    expect(meshSource.data.error).toBeNull()
  })
})
