import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type {
  CustomerDraft,
  DeliveryDraft,
  Product,
  TransactionStatus,
} from './types'

export interface CheckoutState {
  step: 1 | 2 | 3 | 4 | 5
  productSnapshot: Product | null
  // Fixed at 1 for now — the PRD's screens don't include a quantity selector.
  // A future `quantitySelected` action would live here if that changes.
  quantity: number
  customerDraft: CustomerDraft | null
  deliveryDraft: DeliveryDraft | null
  transactionId: string | null
  reference: string | null
  status: TransactionStatus | null
  errorReason: string | null
}

export const initialState: CheckoutState = {
  step: 1,
  productSnapshot: null,
  quantity: 1,
  customerDraft: null,
  deliveryDraft: null,
  transactionId: null,
  reference: null,
  status: null,
  errorReason: null,
}

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    // Screen 1 -> 2: the product just shown is snapshotted so pricing stays
    // stable through the rest of the flow even if stock changes elsewhere.
    productSelected(state, action: PayloadAction<Product>) {
      state.productSnapshot = action.payload
      state.step = 2
    },
    // Screen 2 -> 3: card data is deliberately not part of this payload — it
    // lives only in PaymentModal's local react-hook-form state and is
    // discarded once gatewayClient.tokenize() resolves. See TDD.md.
    customerInfoSubmitted(
      state,
      action: PayloadAction<{
        customer: CustomerDraft
        delivery: DeliveryDraft
      }>,
    ) {
      state.customerDraft = action.payload.customer
      state.deliveryDraft = action.payload.delivery
      state.step = 3
    },
    // Screen 3 -> 4: the transaction was created; it may already be resolved
    // (status !== 'PENDING') or still need polling via GET /transactions/:id.
    transactionCreated(
      state,
      action: PayloadAction<{
        transactionId: string
        reference: string
        status: TransactionStatus
        errorReason?: string | null
      }>,
    ) {
      state.transactionId = action.payload.transactionId
      state.reference = action.payload.reference
      state.status = action.payload.status
      state.errorReason = action.payload.errorReason ?? null
      state.step = 4
    },
    // Still screen 4: polling resolved a PENDING transaction to its final
    // status. Doesn't move `step` — it's already there.
    transactionStatusUpdated(
      state,
      action: PayloadAction<{
        status: TransactionStatus
        errorReason?: string | null
      }>,
    ) {
      state.status = action.payload.status
      state.errorReason = action.payload.errorReason ?? null
    },
    // Screen 5: back to the product page for a brand new checkout.
    checkoutReset() {
      return initialState
    },
  },
})

export const {
  productSelected,
  customerInfoSubmitted,
  transactionCreated,
  transactionStatusUpdated,
  checkoutReset,
} = checkoutSlice.actions

export default checkoutSlice.reducer
