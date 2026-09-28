import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { CustomerDraft, DeliveryDraft } from './schemas'
import type { Product, TransactionStatus } from './types'

export interface CreateTransactionRequest {
  idempotencyKey: string
  productId: string
  quantity: number
  cardToken: string
  paymentAcceptanceToken: string
  personalDataAuthToken: string
  customer: CustomerDraft
  delivery: DeliveryDraft
}

export interface AcceptanceTokens {
  termsToken: string
  termsUrl: string
  personalDataToken: string
  personalDataUrl: string
}

export interface TransactionAmount {
  unitPrice: number
  quantity: number
  subtotal: number
  taxRate: number
  taxAmount: number
  product: number
  baseFee: number
  deliveryFee: number
  total: number
  currency: string
}

export interface TransactionCard {
  brand: string | null
  last4: string | null
}

export interface TransactionCustomerSummary {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface TransactionDeliverySummary {
  address: string
  city: string
  region: string | null
  postalCode: string | null
  notes: string | null
}

export interface TransactionResult {
  transactionId: string
  reference: string
  status: TransactionStatus
  card: TransactionCard | null
  // Present only when status is DECLINED or ERROR — see specs/API-CONTRACT.md.
  reason?: string
  amount: TransactionAmount
  createdAt: string
}

export interface TransactionDetailResult extends TransactionResult {
  customer: TransactionCustomerSummary
  delivery: TransactionDeliverySummary
}

export const api = createApi({
  reducerPath: 'api',
  // The frontend and /api/* share an origin behind CloudFront — no base host
  // needed, see frontend/specs/TDD.md's Env vars section.
  baseQuery: fetchBaseQuery({ baseUrl: '/api', responseHandler: 'json' }),
  endpoints: (builder) => ({
    getCurrentProduct: builder.query<Product, void>({
      query: () => 'products/current',
    }),
    // Proxied through our backend, not called directly from the browser like
    // gatewayClient.ts's tokenizeCard — the gateway's merchant-info endpoint
    // has no CORS support for cross-origin (browser) requests.
    getAcceptanceTokens: builder.query<AcceptanceTokens, void>({
      query: () => 'payment/acceptance-tokens',
    }),
    createTransaction: builder.mutation<
      TransactionResult,
      CreateTransactionRequest
    >({
      query: (body) => ({ url: 'transactions', method: 'POST', body }),
    }),
    // `pollingInterval` is set by the caller (FinalStatusPage, screen 4) via
    // this hook's options, active only while the last known status is
    // PENDING — see frontend/specs/TDD.md.
    getTransaction: builder.query<TransactionDetailResult, string>({
      query: (id) => `transactions/${id}`,
    }),
  }),
})

export const {
  useGetCurrentProductQuery,
  useGetAcceptanceTokensQuery,
  useCreateTransactionMutation,
  useGetTransactionQuery,
} = api
