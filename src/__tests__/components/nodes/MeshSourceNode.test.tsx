import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from 'reactflow'
import { MeshSourceNode } from '@/components/nodes/MeshSourceNode'
import { useMeshStore } from '@/stores/meshStore'

// Wrapper component that provides React Flow context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>
}

describe('MeshSourceNode', () => {
  beforeEach(() => {
    // Reset mesh store
    useMeshStore.setState({
      meshes: {},
      activeMeshId: null,
    })
  })

  const defaultProps = {
    id: 'test-node-1',
    data: {
      label: 'Mesh Source',
      status: 'idle' as const,
      meshId: null,
      meshName: null,
      error: null,
    },
    selected: false,
    type: 'mesh-source',
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    dragging: false,
  }

  it('renders node with label', () => {
    render(
      <TestWrapper>
        <MeshSourceNode {...defaultProps} />
      </TestWrapper>
    )

    expect(screen.getByText('Mesh Source')).toBeInTheDocument()
  })

  it('renders Load File button', () => {
    render(
      <TestWrapper>
        <MeshSourceNode {...defaultProps} />
      </TestWrapper>
    )

    expect(screen.getByText('Load File')).toBeInTheDocument()
  })

  it('shows "No mesh loaded" when meshName is null', () => {
    render(
      <TestWrapper>
        <MeshSourceNode {...defaultProps} />
      </TestWrapper>
    )

    expect(screen.getByText('No mesh loaded')).toBeInTheDocument()
  })

  it('shows mesh name when mesh is loaded', () => {
    const propsWithMesh = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        status: 'pass' as const,
        meshId: 'mesh-1',
        meshName: 'my-model.glb',
      },
    }

    render(
      <TestWrapper>
        <MeshSourceNode {...propsWithMesh} />
      </TestWrapper>
    )

    expect(screen.getByText('my-model.glb')).toBeInTheDocument()
  })

  it('shows error message when error is present', () => {
    const propsWithError = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        status: 'error' as const,
        error: 'Failed to load mesh',
      },
    }

    render(
      <TestWrapper>
        <MeshSourceNode {...propsWithError} />
      </TestWrapper>
    )

    expect(screen.getByText('Failed to load mesh')).toBeInTheDocument()
  })

  it('shows Loading... button when status is running', () => {
    const propsLoading = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        status: 'running' as const,
      },
    }

    render(
      <TestWrapper>
        <MeshSourceNode {...propsLoading} />
      </TestWrapper>
    )

    const button = screen.getByText('Loading...')
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('has file input with correct accept attribute', () => {
    render(
      <TestWrapper>
        <MeshSourceNode {...defaultProps} />
      </TestWrapper>
    )

    const fileInput = screen.getByTestId('mesh-file-input')
    expect(fileInput).toHaveAttribute('accept')
    expect(fileInput.getAttribute('accept')).toContain('.glb')
    expect(fileInput.getAttribute('accept')).toContain('.stl')
    expect(fileInput.getAttribute('accept')).toContain('.obj')
  })

  it('renders sample meshes dropdown with options', () => {
    render(
      <TestWrapper>
        <MeshSourceNode {...defaultProps} />
      </TestWrapper>
    )

    const select = screen.getByTestId('sample-mesh-select')
    expect(select).not.toBeDisabled()

    // Check that sample options are present
    expect(screen.getByText('Open Shell (Device Enclosure)')).toBeInTheDocument()
    expect(screen.getByText('Floaters (Messy Kitbash)')).toBeInTheDocument()
    expect(screen.getByText('Non-Manifold (Bad Boolean)')).toBeInTheDocument()
  })

  it('disables sample dropdown when loading', () => {
    const propsLoading = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        status: 'running' as const,
      },
    }

    render(
      <TestWrapper>
        <MeshSourceNode {...propsLoading} />
      </TestWrapper>
    )

    const select = screen.getByTestId('sample-mesh-select')
    expect(select).toBeDisabled()
  })
})
