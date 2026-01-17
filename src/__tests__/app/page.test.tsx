import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent('SuperCraft Print')
  })

  it('renders the description', () => {
    render(<Home />)

    expect(screen.getByText(/Printability Analysis/i)).toBeInTheDocument()
  })
})
