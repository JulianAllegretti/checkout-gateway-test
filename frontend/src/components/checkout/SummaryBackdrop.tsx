import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../../app/store'
import { useCreateTransactionMutation } from '../../features/checkout/api'
import { transactionCreated } from '../../features/checkout/checkoutSlice'
import { formatMoney } from '../../lib/format'
import type { PaymentSecrets } from './PaymentModal'

const ERROR_MESSAGES: Record<string, string> = {
  OUT_OF_STOCK:
    'This product just sold out. Please go back and try again later.',
  VALIDATION_ERROR:
    'Some of your information was invalid. Please review and try again.',
  PRODUCT_NOT_FOUND: 'This product is no longer available.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
}

function errorMessageFrom(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (data && typeof data === 'object' && 'errorCode' in data) {
      const message = ERROR_MESSAGES[(data as { errorCode: string }).errorCode]
      if (message) return message
    }
  }
  return 'Something went wrong. Please try again.'
}

export interface SummaryBackdropProps {
  paymentSecrets: PaymentSecrets
}

export function SummaryBackdrop({ paymentSecrets }: SummaryBackdropProps) {
  const dispatch = useDispatch()
  const {
    productSnapshot: product,
    quantity,
    customerDraft,
    deliveryDraft,
  } = useSelector((state: RootState) => state.checkout)
  const [createTransaction, { isLoading }] = useCreateTransactionMutation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Generated once per mount and reused on every retry within this attempt
  // (not a fresh submit) — a retried request can't double-charge or
  // double-reserve stock. See frontend/specs/TDD.md.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  if (!product || !customerDraft || !deliveryDraft) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-gray-500">
          Something went wrong. Please start over.
        </p>
      </main>
    )
  }

  // Rebound as their own const bindings: TypeScript doesn't carry the
  // null-check above into the handlePay closure below.
  const safeProduct = product
  const safeCustomer = customerDraft
  const safeDelivery = deliveryDraft

  const subtotal = safeProduct.unitPrice * quantity
  const taxAmount = safeProduct.taxAmount * quantity
  const productAmount = safeProduct.price * quantity
  const total = productAmount + safeProduct.baseFee + safeProduct.deliveryFee

  async function handlePay() {
    setSubmitError(null)
    try {
      const data = await createTransaction({
        idempotencyKey,
        productId: safeProduct.id,
        quantity,
        cardToken: paymentSecrets.cardToken,
        paymentAcceptanceToken: paymentSecrets.paymentAcceptanceToken,
        personalDataAuthToken: paymentSecrets.personalDataAuthToken,
        customer: safeCustomer,
        delivery: safeDelivery,
      }).unwrap()

      dispatch(
        transactionCreated({
          transactionId: data.transactionId,
          reference: data.reference,
          status: data.status,
          errorReason: data.reason ?? null,
        }),
      )
    } catch (error) {
      setSubmitError(errorMessageFrom(error))
    }
  }

  return (
    <Dialog open onClose={() => {}} className="relative z-10">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      {/* The outer layer scrolls (see PaymentModal's identical fix) — this
          panel is usually short enough to fit, but a long product name or
          error message shouldn't be able to trap content off-screen. */}
      <div className="fixed inset-0 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
          <DialogPanel className="w-full max-w-md space-y-4 rounded-t-xl bg-white p-6 sm:rounded-xl">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Order summary
            </DialogTitle>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Unit price × {quantity}</dt>
                <dd className="text-gray-900">
                  {formatMoney(subtotal, product.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">IVA</dt>
                <dd className="text-gray-900">
                  {formatMoney(taxAmount, product.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Base fee</dt>
                <dd className="text-gray-900">
                  {formatMoney(product.baseFee, product.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Delivery fee</dt>
                <dd className="text-gray-900">
                  {formatMoney(product.deliveryFee, product.currency)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                <dt className="text-gray-900">Total</dt>
                <dd className="text-gray-900">
                  {formatMoney(total, product.currency)}
                </dd>
              </div>
            </dl>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">
                {submitError}
              </p>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={isLoading}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isLoading ? 'Processing...' : 'Pay'}
            </button>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
