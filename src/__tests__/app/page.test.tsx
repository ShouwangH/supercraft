import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

describe('Home Page', () => {
  it('renders the node canvas', () => {
    render(<Home />)

    // The initial MeshSourceNode should be rendered
    expect(screen.getByText('Mesh Source')).toBeInTheDocument()
  })

  it('shows the initial mesh source node with load options', () => {
    render(<Home />)

    expect(screen.getByText('Load File')).toBeInTheDocument()
    expect(screen.getByText('No mesh loaded')).toBeInTheDocument()
  })
})
