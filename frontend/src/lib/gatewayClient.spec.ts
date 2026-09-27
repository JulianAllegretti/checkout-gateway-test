import type { CardDraft } from '../features/checkout/schemas'
import { getAcceptanceToken, tokenizeCard } from './gatewayClient'

const card: CardDraft = {
  number: '4111111111111111',
  expiry: '12/30',
  cvc: '123',
  cardholderName: 'Jane Doe',
}

function mockFetchOnce(body: unknown, ok = true) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: async () => body,
  })
}

describe('tokenizeCard', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('posts the card split into the gateway-expected fields', async () => {
    mockFetchOnce({
      data: { id: 'tok_test_1', brand: 'VISA', last_four: '1111' },
    })

    await tokenizeCard(card)

    expect(fetch).toHaveBeenCalledWith(
      'https://api-sandbox.example-gateway.dev/v1/tokens/cards',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer pub_test_mock',
        }),
        body: JSON.stringify({
          number: '4111111111111111',
          cvc: '123',
          exp_month: '12',
          exp_year: '30',
          card_holder: 'Jane Doe',
        }),
      }),
    )
  })

  it('resolves with the token, brand and last4', async () => {
    mockFetchOnce({
      data: { id: 'tok_test_1', brand: 'VISA', last_four: '1111' },
    })

    const result = await tokenizeCard(card)

    expect(result).toEqual({
      cardToken: 'tok_test_1',
      brand: 'VISA',
      last4: '1111',
    })
  })

  it('normalizes an unrecognized brand to null', async () => {
    mockFetchOnce({
      data: { id: 'tok_test_1', brand: 'AMEX', last_four: '0005' },
    })

    const result = await tokenizeCard(card)

    expect(result.brand).toBeNull()
  })

  it('throws when the gateway responds with an error status', async () => {
    mockFetchOnce({ error: { messages: { number: ['invalid'] } } }, false)

    await expect(tokenizeCard(card)).rejects.toThrow('Card tokenization failed')
  })
})

describe('getAcceptanceToken', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('fetches merchant info with the public key header', async () => {
    mockFetchOnce({
      data: { presigned_acceptance: { acceptance_token: 'accept_123' } },
    })

    await getAcceptanceToken()

    expect(fetch).toHaveBeenCalledWith(
      'https://api-sandbox.example-gateway.dev/v1/merchants/info',
      {
        headers: { 'x-merchant-public-key': 'pub_test_mock' },
      },
    )
  })

  it('resolves with the presigned acceptance token', async () => {
    mockFetchOnce({
      data: { presigned_acceptance: { acceptance_token: 'accept_123' } },
    })

    await expect(getAcceptanceToken()).resolves.toBe('accept_123')
  })

  it('throws when the gateway responds with an error status', async () => {
    mockFetchOnce({}, false)

    await expect(getAcceptanceToken()).rejects.toThrow(
      'Failed to fetch the payment acceptance token',
    )
  })
})
