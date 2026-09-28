import { skipToken } from '@reduxjs/toolkit/query/react'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../app/store'
import { useGetTransactionQuery } from '../features/checkout/api'
import { transactionStatusUpdated } from '../features/checkout/checkoutSlice'

const STATUS_COPY: Record<
  'APPROVED' | 'DECLINED' | 'ERROR',
  { title: string; tone: string }
> = {
  APPROVED: { title: 'Payment approved', tone: 'text-green-600' },
  DECLINED: { title: 'Payment declined', tone: 'text-red-600' },
  ERROR: { title: 'Something went wrong', tone: 'text-red-600' },
}

export function FinalStatusPage() {
  const dispatch = useDispatch()
  const { transactionId, reference, status, errorReason } = useSelector(
    (state: RootState) => state.checkout,
  )

  // Polling is driven by the last known status in the store, not local
  // component state — so it survives a refresh (transactionId/status are
  // persisted, see checkoutSlice) and stops as soon as a poll resolves it.
  const { data } = useGetTransactionQuery(transactionId ?? skipToken, {
    pollingInterval: status === 'PENDING' ? 3000 : 0,
  })

  useEffect(() => {
    if (data && data.status !== status) {
      dispatch(
        transactionStatusUpdated({
          status: data.status,
          errorReason: data.reason ?? null,
        }),
      )
    }
  }, [data, status, dispatch])

  if (!transactionId || !status) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-gray-500">
          Something went wrong. Please start over.
        </p>
      </main>
    )
  }

  if (status === 'PENDING') {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-gray-500">Confirming your payment...</p>
      </main>
    )
  }

  const { title, tone } = STATUS_COPY[status]

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className={`text-2xl font-bold ${tone}`}>{title}</h1>
      <p className="text-gray-600">Reference: {reference}</p>
      {errorReason && <p className="text-sm text-gray-500">{errorReason}</p>}
    </main>
  )
}
