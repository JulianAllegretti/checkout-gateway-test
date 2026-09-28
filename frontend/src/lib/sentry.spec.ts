import * as Sentry from '@sentry/react'
import { initSentry, redact } from './sentry'

jest.mock('@sentry/react')

const mockedInit = Sentry.init as jest.Mock

describe('redact', () => {
  it('replaces sensitive keys with a placeholder, wherever they are nested', () => {
    expect(
      redact({
        transactionId: 'tx-1',
        customer: { email: 'jane@example.com', firstName: 'Jane' },
        delivery: [{ address: 'Calle 123 #45-67', city: 'Bogotá' }],
      }),
    ).toEqual({
      transactionId: 'tx-1',
      customer: { email: '[Redacted]', firstName: '[Redacted]' },
      delivery: [{ address: '[Redacted]', city: '[Redacted]' }],
    })
  })

  it('leaves primitives and non-sensitive keys untouched', () => {
    expect(redact('a string')).toBe('a string')
    expect(redact(42)).toBe(42)
    expect(redact(null)).toBeNull()
    expect(redact({ transactionId: 'tx-1', status: 'APPROVED' })).toEqual({
      transactionId: 'tx-1',
      status: 'APPROVED',
    })
  })
})

describe('initSentry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initializes with the redacting hooks wired up', () => {
    initSentry()

    expect(mockedInit).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      }),
    )
  })

  it("redacts an event's request/extra/contexts before it would be sent", () => {
    initSentry()
    const { beforeSend } = mockedInit.mock.calls[0][0]

    const result = beforeSend({
      request: { data: { email: 'jane@example.com' } },
      extra: { customer: { phone: '+573001234567' } },
      contexts: { checkout: { deliveryDraft: { address: 'Calle 123' } } },
    })

    expect(result.request.data.email).toBe('[Redacted]')
    expect(result.extra.customer.phone).toBe('[Redacted]')
    expect(result.contexts.checkout.deliveryDraft.address).toBe('[Redacted]')
  })

  it('leaves an event with no request/extra/contexts untouched', () => {
    initSentry()
    const { beforeSend } = mockedInit.mock.calls[0][0]

    const event = { message: 'boom' }
    expect(beforeSend(event)).toBe(event)
  })

  it('redacts a breadcrumb’s data before it would be attached', () => {
    initSentry()
    const { beforeBreadcrumb } = mockedInit.mock.calls[0][0]

    const result = beforeBreadcrumb({
      category: 'fetch',
      data: { cardToken: 'tok_test_1', url: '/api/transactions' },
    })

    expect(result.data.cardToken).toBe('[Redacted]')
    expect(result.data.url).toBe('/api/transactions')
  })

  it('leaves a breadcrumb with no data untouched', () => {
    initSentry()
    const { beforeBreadcrumb } = mockedInit.mock.calls[0][0]

    const breadcrumb = { category: 'navigation' }
    expect(beforeBreadcrumb(breadcrumb)).toBe(breadcrumb)
  })
})
