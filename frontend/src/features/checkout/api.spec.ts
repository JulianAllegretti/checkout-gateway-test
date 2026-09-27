import { configureStore } from '@reduxjs/toolkit'
import { api } from './api'
import type { Product } from './types'

function createTestStore() {
  return configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  })
}

function mockFetchOnce(body: unknown, status = 200) {
  const text = JSON.stringify(body)
  // fetchBaseQuery always drains the response via `.text()` (even with
  // responseHandler: 'json', and again on the `.clone()`) — see its source.
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    clone() {
      return this
    },
  })
}

// fetchBaseQuery always calls `fetch` with a single Fetch API `Request`
// object (never `fetch(url, options)`), so assertions read it back out.
function lastRequest(): Request {
  const [request] = (fetch as jest.Mock).mock.calls.at(-1) as [Request]
  return request
}

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

describe('api', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('getCurrentProduct calls GET /api/products/current', async () => {
    mockFetchOnce(product)
    const store = createTestStore()

    const result = await store.dispatch(
      api.endpoints.getCurrentProduct.initiate(),
    )

    const request = lastRequest()
    expect(request.method).toBe('GET')
    expect(new URL(request.url, 'http://localhost').pathname).toBe(
      '/api/products/current',
    )
    expect(result.data).toEqual(product)
  })

  it('createTransaction posts to /api/transactions with the request as the JSON body', async () => {
    const requestBody = {
      idempotencyKey: '6c1f6e2e-1b3a-4b3a-9b3a-1b3a4b3a9b3a',
      productId: product.id,
      quantity: 1,
      cardToken: 'tok_test_1',
      paymentAcceptanceToken: 'accept_123',
      customer: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+573001234567',
      },
      delivery: { address: 'Calle 123 #45-67', city: 'Bogotá' },
    }
    const response = {
      transactionId: '8a2e-uuid',
      reference: requestBody.idempotencyKey,
      status: 'PENDING' as const,
      card: null,
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
    mockFetchOnce(response, 201)
    const store = createTestStore()

    const result = await store.dispatch(
      api.endpoints.createTransaction.initiate(requestBody),
    )

    const request = lastRequest()
    expect(request.method).toBe('POST')
    expect(new URL(request.url, 'http://localhost').pathname).toBe(
      '/api/transactions',
    )
    await expect(request.text()).resolves.toBe(JSON.stringify(requestBody))
    expect(result.data).toEqual(response)
  })

  it('getTransaction calls GET /api/transactions/:id', async () => {
    mockFetchOnce({ transactionId: '8a2e-uuid', status: 'PENDING' }, 200)
    const store = createTestStore()

    const result = await store.dispatch(
      api.endpoints.getTransaction.initiate('8a2e-uuid'),
    )

    const request = lastRequest()
    expect(request.method).toBe('GET')
    expect(new URL(request.url, 'http://localhost').pathname).toBe(
      '/api/transactions/8a2e-uuid',
    )
    expect(result.data).toEqual({
      transactionId: '8a2e-uuid',
      status: 'PENDING',
    })
  })

  it('surfaces a non-2xx response as an RTK Query error, not a throw', async () => {
    mockFetchOnce(
      { statusCode: 409, errorCode: 'OUT_OF_STOCK', message: 'no stock' },
      409,
    )
    const store = createTestStore()

    const result = await store.dispatch(
      api.endpoints.getCurrentProduct.initiate(),
    )

    expect(result.error).toEqual(
      expect.objectContaining({
        status: 409,
        data: expect.objectContaining({ errorCode: 'OUT_OF_STOCK' }),
      }),
    )
  })
})
