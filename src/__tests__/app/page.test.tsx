import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

describe('Home Page', () => {
  it('renders the Inspector panel', () => {
    render(<Home />)

    expect(screen.getByText('Inspector')).toBeInTheDocument()
  })

  it('shows select node prompt when no node selected', () => {
    render(<Home />)

    expect(screen.getByText('Select a node to view details')).toBeInTheDocument()
  })
})
