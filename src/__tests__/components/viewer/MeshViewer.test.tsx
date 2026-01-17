import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MeshViewer } from '@/components/viewer/MeshViewer'
import { useViewerStore } from '@/stores/viewerStore'

describe('MeshViewer', () => {
  beforeEach(() => {
    useViewerStore.setState({
      showGrid: true,
      showAxes: false,
      wireframe: false,
    })
  })

  it('renders the viewer container', () => {
    render(<MeshViewer />)

    const container = screen.getByTestId('mesh-viewer')
    expect(container).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<MeshViewer className="custom-class" />)

    const container = screen.getByTestId('mesh-viewer')
    expect(container).toHaveClass('custom-class')
  })

  it('has full width and height classes', () => {
    render(<MeshViewer />)

    const container = screen.getByTestId('mesh-viewer')
    expect(container).toHaveClass('w-full')
    expect(container).toHaveClass('h-full')
  })
})
