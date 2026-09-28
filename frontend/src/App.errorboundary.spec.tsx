import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { reloadPage } from './lib/reload'

// Isolated in its own file: mocking ProductPage to throw would otherwise
// break App.spec.tsx's tests that rely on it rendering for real.
jest.mock('./pages/ProductPage', () => ({
  ProductPage: () => {
    throw new Error('boom')
  },
}))
jest.mock('./lib/reload')

const mockedReloadPage = reloadPage as jest.Mock

describe('App error boundary', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    // React (and Sentry's ErrorBoundary) log the caught error via
    // console.error — expected here, so it's silenced to keep the test
    // output from looking like a real failure.
    console.error = jest.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('shows a fallback with a reload option instead of crashing the whole app', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(
      await screen.findByText(/something went wrong\. please reload/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reload' }))

    expect(mockedReloadPage).toHaveBeenCalled()
  })
})
