import checkoutReducer, {
  checkoutReset,
  customerInfoSubmitted,
  productSelected,
  transactionCreated,
  transactionStatusUpdated,
} from './checkoutSlice'
import type { CustomerDraft, DeliveryDraft, Product } from './types'

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

const delivery: DeliveryDraft = {
  address: 'Calle 123 #45-67',
  city: 'Bogotá',
}

describe('checkoutSlice', () => {
  it('starts on step 1 with everything else empty', () => {
    expect(checkoutReducer(undefined, { type: '@@INIT' })).toEqual({
      step: 1,
      productSnapshot: null,
      quantity: 1,
      customerDraft: null,
      deliveryDraft: null,
      transactionId: null,
      reference: null,
      status: null,
      errorReason: null,
    })
  })

  it('never has a card-related field in its state, by construction', () => {
    const state = checkoutReducer(undefined, { type: '@@INIT' })
    expect(Object.keys(state).join(',').toLowerCase()).not.toMatch(
      /card|cvc|token/,
    )
  })

  it('step only advances as the checkout progresses', () => {
    let state = checkoutReducer(undefined, { type: '@@INIT' })
    expect(state.step).toBe(1)

    state = checkoutReducer(state, productSelected(product))
    expect(state.step).toBe(2)
    expect(state.productSnapshot).toEqual(product)

    state = checkoutReducer(
      state,
      customerInfoSubmitted({ customer, delivery }),
    )
    expect(state.step).toBe(3)
    expect(state.customerDraft).toEqual(customer)
    expect(state.deliveryDraft).toEqual(delivery)

    state = checkoutReducer(
      state,
      transactionCreated({
        transactionId: 'tx-1',
        reference: 'TRX-1',
        status: 'PENDING',
      }),
    )
    expect(state.step).toBe(4)
    expect(state.transactionId).toBe('tx-1')
    expect(state.reference).toBe('TRX-1')
    expect(state.status).toBe('PENDING')
    expect(state.errorReason).toBeNull()

    // Polling resolves the transaction — status changes, step does not move.
    state = checkoutReducer(
      state,
      transactionStatusUpdated({ status: 'APPROVED' }),
    )
    expect(state.step).toBe(4)
    expect(state.status).toBe('APPROVED')
  })

  it('stores the decline/error reason when the transaction is not approved', () => {
    const state = checkoutReducer(
      undefined,
      transactionStatusUpdated({
        status: 'DECLINED',
        errorReason: 'Insufficient funds',
      }),
    )
    expect(state.status).toBe('DECLINED')
    expect(state.errorReason).toBe('Insufficient funds')
  })

  it('resets back to the initial state for a new checkout', () => {
    const inProgress = checkoutReducer(undefined, productSelected(product))
    expect(checkoutReducer(inProgress, checkoutReset())).toEqual(
      checkoutReducer(undefined, { type: '@@INIT' }),
    )
  })
})
