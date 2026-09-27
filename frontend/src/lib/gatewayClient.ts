import type { CardBrand, CardDraft } from '../features/checkout/schemas'
import { env } from './env'

export interface TokenizedCard {
  cardToken: string
  brand: CardBrand | null
  last4: string
}

async function parseOkJson(
  response: Response,
  errorMessage: string,
): Promise<unknown> {
  if (!response.ok) throw new Error(errorMessage)
  return response.json()
}

/**
 * Tokenizes the card directly with the gateway's sandbox — this call never
 * goes through our backend, so the PAN/CVC never reach it (see ADR 0001).
 */
export async function tokenizeCard(card: CardDraft): Promise<TokenizedCard> {
  const [expMonth, expYear] = card.expiry.split('/')

  const response = await fetch(`${env.paymentApiUrl}/tokens/cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.paymentPublicKey}`,
    },
    body: JSON.stringify({
      number: card.number,
      cvc: card.cvc,
      exp_month: expMonth,
      exp_year: expYear,
      card_holder: card.cardholderName,
    }),
  })

  const body = (await parseOkJson(response, 'Card tokenization failed')) as {
    data: { id: string; brand: string; last_four: string }
  }

  const brand =
    body.data.brand === 'VISA' || body.data.brand === 'MASTERCARD'
      ? body.data.brand
      : null

  return { cardToken: body.data.id, brand, last4: body.data.last_four }
}

/**
 * The privacy-policy acceptance token required by `POST /transactions`'
 * `paymentAcceptanceToken` field (see specs/API-CONTRACT.md). The gateway
 * also issues a separate personal-data-authorization token
 * (`accept_personal_auth`), but nothing in our current API contract consumes
 * it, so it's not fetched here.
 */
export async function getAcceptanceToken(): Promise<string> {
  const response = await fetch(`${env.paymentApiUrl}/merchants/info`, {
    headers: { 'x-merchant-public-key': env.paymentPublicKey },
  })

  const body = (await parseOkJson(
    response,
    'Failed to fetch the payment acceptance token',
  )) as {
    data: { presigned_acceptance: { acceptance_token: string } }
  }

  return body.data.presigned_acceptance.acceptance_token
}
