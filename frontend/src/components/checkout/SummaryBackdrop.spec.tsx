import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { useCreateTransactionMutation } from '../../features/checkout/api'
import checkoutReducer, {
  customerInfoSubmitted,
  productSelected,
} from '../../features/checkout/checkoutSlice'
import type {
  CustomerDraft,
  DeliveryDraft,
} from '../../features/checkout/schemas'
import type { Product } from '../../features/checkout/types'
import type { PaymentSecrets } from './PaymentModal'
import { SummaryBackdrop } from './SummaryBackdrop'

jest.mock('../../features/checkout/api')

const mockedUseCreateTransactionMutation =
  useCreateTransactionMutation as jest.Mock

const product: Product = {
  id: 'b3f1c2a0-uuid',
  name: 'Wireless Headphones',
  description: 'Over-ear, active noise cancellation.',
  unitPrice: 350000,
  taxRate: 0.19,
  taxAmount: 66500,
  price: 416500,
  stock: 12,
  imageUrl: 'https://example.com/headphones.jpg',
  baseFee: 5000,
  deliveryFee: 8000,
  currency: 'COP',
}

const customer: CustomerDraft = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+573001234567',
}
const delivery: DeliveryDraft = { address: 'Calle 123 #45-67', city: 'Bogotá' }
const paymentSecrets: PaymentSecrets = {
  cardToken: 'tok_test_1',
  cardBrand: 'VISA',
  cardLast4: '1111',
  paymentAcceptanceToken: 'accept_123',
  personalDataAuthToken: 'accept_personal_123',
}

function renderSummary(secrets: PaymentSecrets = paymentSecrets) {
  const store = configureStore({ reducer: { checkout: checkoutReducer } })
  store.dispatch(productSelected(product))
  store.dispatch(customerInfoSubmitted({ customer, delivery }))
  render(
    <Provider store={store}>
      <SummaryBackdrop paymentSecrets={secrets} />
    </Provider>,
  )
  return store
}

const approvedResponse = {
  transactionId: 'tx-1',
  reference: 'ref-1',
  status: 'APPROVED' as const,
  card: { brand: 'VISA', last4: '1111' },
  amount: {
    unitPrice: 350000,
    quantity: 1,
    subtotal: 350000,
    taxRate: 0.19,
    taxAmount: 66500,
    product: 416500,
    baseFee: 5000,
    deliveryFee: 8000,
    total: 429500,
    currency: 'COP',
  },
  createdAt: '2026-09-25T14:03:00.000Z',
}

// createTransaction(...) returns an object whose `.unwrap()` resolves with
// the data or rejects with the error — matching RTK Query's real mutation
// trigger shape (SummaryBackdrop.tsx uses .unwrap(), not the raw {data}/
// {error} result).
function mockCreateTransactionResolving(data: unknown) {
  return jest.fn().mockReturnValue({ unwrap: () => Promise.resolve(data) })
}

function mockCreateTransactionRejecting(...errors: unknown[]) {
  const fn = jest.fn()
  for (const error of errors) {
    fn.mockReturnValueOnce({ unwrap: () => Promise.reject(error) })
  }
  return fn
}

describe('SummaryBackdrop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('computes and displays the fee breakdown from the product snapshot', () => {
    mockedUseCreateTransactionMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ])
    renderSummary()

    expect(screen.getByText(/350\.000/)).toBeInTheDocument() // unit price x quantity
    expect(screen.getByText(/66\.500/)).toBeInTheDocument() // IVA
    expect(screen.getByText(/5\.000/)).toBeInTheDocument() // base fee
    expect(screen.getByText(/8\.000/)).toBeInTheDocument() // delivery fee
    expect(screen.getByText(/429\.500/)).toBeInTheDocument() // total
  })

  it('disables the button and relabels it while the mutation is pending', () => {
    mockedUseCreateTransactionMutation.mockReturnValue([
      jest.fn(),
      { isLoading: true },
    ])
    renderSummary()

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled()
  })

  it('creates the transaction and advances to step 4 on success', async () => {
    const user = userEvent.setup()
    const createTransaction = mockCreateTransactionResolving(approvedResponse)
    mockedUseCreateTransactionMutation.mockReturnValue([
      createTransaction,
      { isLoading: false },
    ])
    const store = renderSummary()

    await user.click(screen.getByRole('button', { name: 'Pay' }))

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: product.id,
        quantity: 1,
        cardToken: 'tok_test_1',
        paymentAcceptanceToken: 'accept_123',
        personalDataAuthToken: 'accept_personal_123',
        customer,
        delivery,
      }),
    )
    expect(store.getState().checkout.step).toBe(4)
    expect(store.getState().checkout.transactionId).toBe('tx-1')
    expect(store.getState().checkout.reference).toBe('ref-1')
    expect(store.getState().checkout.status).toBe('APPROVED')
  })

  it('reuses the same idempotencyKey across retries after a failure', async () => {
    const user = userEvent.setup()
    const createTransaction = jest.fn()
    createTransaction.mockReturnValueOnce({
      unwrap: () =>
        Promise.reject({
          status: 409,
          data: { errorCode: 'OUT_OF_STOCK', message: 'no stock' },
        }),
    })
    createTransaction.mockReturnValueOnce({
      unwrap: () => Promise.resolve(approvedResponse),
    })
    mockedUseCreateTransactionMutation.mockReturnValue([
      createTransaction,
      { isLoading: false },
    ])
    renderSummary()

    await user.click(screen.getByRole('button', { name: 'Pay' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This product just sold out',
    )

    await user.click(screen.getByRole('button', { name: 'Pay' }))

    const [firstCall] = createTransaction.mock.calls[0]
    const [secondCall] = createTransaction.mock.calls[1]
    expect(secondCall.idempotencyKey).toBe(firstCall.idempotencyKey)
  })

  it.each([
    [
      'OUT_OF_STOCK',
      'This product just sold out. Please go back and try again later.',
    ],
    [
      'VALIDATION_ERROR',
      'Some of your information was invalid. Please review and try again.',
    ],
    ['PRODUCT_NOT_FOUND', 'This product is no longer available.'],
    ['INTERNAL_ERROR', 'Something went wrong on our end. Please try again.'],
    ['SOMETHING_UNMAPPED', 'Something went wrong. Please try again.'],
  ])(
    'maps the %s error code to a user-facing message and does not advance the step',
    async (errorCode, message) => {
      const user = userEvent.setup()
      const createTransaction = mockCreateTransactionRejecting({
        status: 400,
        data: { errorCode },
      })
      mockedUseCreateTransactionMutation.mockReturnValue([
        createTransaction,
        { isLoading: false },
      ])
      const store = renderSummary()

      await user.click(screen.getByRole('button', { name: 'Pay' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(store.getState().checkout.step).toBe(3)
    },
  )

  it('falls back to a generic message for an error with no data field (e.g. a network failure)', async () => {
    const user = userEvent.setup()
    const createTransaction = mockCreateTransactionRejecting(
      new Error('network down'),
    )
    mockedUseCreateTransactionMutation.mockReturnValue([
      createTransaction,
      { isLoading: false },
    ])
    renderSummary()

    await user.click(screen.getByRole('button', { name: 'Pay' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })

  it('falls back to a generic message when the data field is not a well-formed error body', async () => {
    const user = userEvent.setup()
    const createTransaction = mockCreateTransactionRejecting({
      status: 500,
      data: 'plain text error',
    })
    mockedUseCreateTransactionMutation.mockReturnValue([
      createTransaction,
      { isLoading: false },
    ])
    renderSummary()

    await user.click(screen.getByRole('button', { name: 'Pay' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })

  it('shows a generic message when required checkout state is missing', () => {
    const store = configureStore({
      reducer: { checkout: checkoutReducer },
      preloadedState: {
        checkout: {
          ...checkoutReducer(undefined, { type: '@@INIT' }),
          step: 3 as const,
          productSnapshot: product,
        },
      },
    })
    mockedUseCreateTransactionMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ])

    render(
      <Provider store={store}>
        <SummaryBackdrop paymentSecrets={paymentSecrets} />
      </Provider>,
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
