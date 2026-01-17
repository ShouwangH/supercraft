import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewerControls } from '@/components/viewer/ViewerControls'
import { useViewerStore } from '@/stores/viewerStore'

describe('ViewerControls', () => {
  beforeEach(() => {
    // Reset store to initial state
    useViewerStore.setState({
      showGrid: true,
      showAxes: false,
      wireframe: false,
    })
  })

  it('renders all control buttons', () => {
    render(<ViewerControls />)

    expect(screen.getByText('Grid')).toBeInTheDocument()
    expect(screen.getByText('Axes')).toBeInTheDocument()
    expect(screen.getByText('Wire')).toBeInTheDocument()
  })

  it('shows grid button as active when grid is visible', () => {
    useViewerStore.setState({ showGrid: true })
    render(<ViewerControls />)

    const gridButton = screen.getByText('Grid')
    expect(gridButton).toHaveClass('bg-blue-600')
  })

  it('shows grid button as inactive when grid is hidden', () => {
    useViewerStore.setState({ showGrid: false })
    render(<ViewerControls />)

    const gridButton = screen.getByText('Grid')
    expect(gridButton).toHaveClass('bg-neutral-700')
  })

  it('toggles grid when grid button is clicked', () => {
    useViewerStore.setState({ showGrid: true })
    render(<ViewerControls />)

    const gridButton = screen.getByText('Grid')
    fireEvent.click(gridButton)

    expect(useViewerStore.getState().showGrid).toBe(false)
  })

  it('toggles axes when axes button is clicked', () => {
    useViewerStore.setState({ showAxes: false })
    render(<ViewerControls />)

    const axesButton = screen.getByText('Axes')
    fireEvent.click(axesButton)

    expect(useViewerStore.getState().showAxes).toBe(true)
  })

  it('toggles wireframe when wire button is clicked', () => {
    useViewerStore.setState({ wireframe: false })
    render(<ViewerControls />)

    const wireButton = screen.getByText('Wire')
    fireEvent.click(wireButton)

    expect(useViewerStore.getState().wireframe).toBe(true)
  })
})
