import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the placeholder shell', async () => {
    render(<App />)
    expect(await screen.findByText('Checkout')).toBeInTheDocument()
  })
})
