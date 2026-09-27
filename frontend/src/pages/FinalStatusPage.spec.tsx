import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import checkoutReducer, {
  transactionCreated,
} from '../features/checkout/checkoutSlice'
import { useGetTransactionQuery } from '../features/checkout/api'
import { FinalStatusPage } from './FinalStatusPage'

jest.mock('../features/checkout/api')

const mockedUseGetTransactionQuery = useGetTransactionQuery as jest.Mock

function renderStatus(
  initial: Parameters<typeof transactionCreated>[0],
  data?: unknown,
) {
  mockedUseGetTransactionQuery.mockReturnValue({ data })
  const store = configureStore({ reducer: { checkout: checkoutReducer } })
  store.dispatch(transactionCreated(initial))
  render(
    <Provider store={store}>
      <FinalStatusPage />
    </Provider>,
  )
  return store
}

describe('FinalStatusPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows a confirming message while the status is PENDING', () => {
    renderStatus({
      transactionId: 'tx-1',
      reference: 'ref-1',
      status: 'PENDING',
    })

    expect(screen.getByText('Confirming your payment...')).toBeInTheDocument()
  })

  it('renders the approved state with the reference', () => {
    renderStatus({
      transactionId: 'tx-1',
      reference: 'ref-1',
      status: 'APPROVED',
    })

    expect(screen.getByText('Payment approved')).toBeInTheDocument()
    expect(screen.getByText('Reference: ref-1')).toBeInTheDocument()
  })

  it('renders the declined state with the gateway reason', () => {
    renderStatus({
      transactionId: 'tx-1',
      reference: 'ref-1',
      status: 'DECLINED',
      errorReason: 'Insufficient funds',
    })

    expect(screen.getByText('Payment declined')).toBeInTheDocument()
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
  })

  it('renders the error state with the failure reason', () => {
    renderStatus({
      transactionId: 'tx-1',
      reference: 'ref-1',
      status: 'ERROR',
      errorReason: 'The gateway could not be reached',
    })

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('The gateway could not be reached'),
    ).toBeInTheDocument()
  })

  it('shows a generic message when there is no transaction to show', () => {
    mockedUseGetTransactionQuery.mockReturnValue({ data: undefined })
    const store = configureStore({ reducer: { checkout: checkoutReducer } })

    render(
      <Provider store={store}>
        <FinalStatusPage />
      </Provider>,
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('applies a poll that resolves a PENDING transaction to its final status', () => {
    const store = renderStatus(
      { transactionId: 'tx-1', reference: 'ref-1', status: 'PENDING' },
      {
        transactionId: 'tx-1',
        reference: 'ref-1',
        status: 'APPROVED',
        card: null,
        amount: {
          unitPrice: 0,
          quantity: 1,
          subtotal: 0,
          taxRate: 0,
          taxAmount: 0,
          product: 0,
          baseFee: 0,
          deliveryFee: 0,
          total: 0,
          currency: 'COP',
        },
        createdAt: '2026-09-25T14:03:00.000Z',
      },
    )

    expect(store.getState().checkout.status).toBe('APPROVED')
    expect(screen.getByText('Payment approved')).toBeInTheDocument()
  })

  it('does not dispatch again once the store already reflects the polled status', () => {
    const store = renderStatus(
      { transactionId: 'tx-1', reference: 'ref-1', status: 'APPROVED' },
      {
        transactionId: 'tx-1',
        reference: 'ref-1',
        status: 'APPROVED',
        card: null,
        amount: {
          unitPrice: 0,
          quantity: 1,
          subtotal: 0,
          taxRate: 0,
          taxAmount: 0,
          product: 0,
          baseFee: 0,
          deliveryFee: 0,
          total: 0,
          currency: 'COP',
        },
        createdAt: '2026-09-25T14:03:00.000Z',
      },
    )

    expect(store.getState().checkout.status).toBe('APPROVED')
  })
})
