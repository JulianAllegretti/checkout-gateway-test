import { z } from 'zod'

export type CardBrand = 'VISA' | 'MASTERCARD'

/** Only the two brands this checkout supports — see specs/SPEC.md. */
export function detectCardBrand(rawNumber: string): CardBrand | null {
  const digits = rawNumber.replace(/\D/g, '')
  if (/^4/.test(digits)) return 'VISA'

  const prefix2 = Number(digits.slice(0, 2))
  const prefix4 = Number(digits.slice(0, 4))
  if (
    (prefix2 >= 51 && prefix2 <= 55) ||
    (prefix4 >= 2221 && prefix4 <= 2720)
  ) {
    return 'MASTERCARD'
  }

  return null
}

/** Standard mod-10 check. Card data is sandbox/fake but must still pass this. */
function passesLuhnCheck(digits: string): boolean {
  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

function isExpiryInThePast(mmYY: string): boolean {
  const [month, twoDigitYear] = mmYY.split('/').map(Number)
  const firstOfNextMonth = new Date(2000 + twoDigitYear, month, 1)
  const firstOfThisMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
  return firstOfNextMonth <= firstOfThisMonth
}

export const cardSchema = z.object({
  number: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((digits) => digits.length >= 13 && digits.length <= 19, {
      error: 'Card number must have between 13 and 19 digits',
    })
    .refine((digits) => detectCardBrand(digits) !== null, {
      error: 'Unsupported card brand — only VISA and MasterCard are accepted',
    })
    .refine(passesLuhnCheck, { error: 'Invalid card number' }),
  expiry: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format')
    .refine((value) => !isExpiryInThePast(value), {
      error: 'Card has expired',
    }),
  // 3 digits covers VISA/MasterCard — the 4-digit CVC some other brands use
  // (e.g. Amex) isn't relevant here, see specs/SPEC.md.
  cvc: z.string().regex(/^\d{3}$/, 'CVC must be 3 digits'),
  cardholderName: z.string().trim().min(1, 'Cardholder name is required'),
})

export type CardDraft = z.infer<typeof cardSchema>

// Mirrors POST /transactions' `customer` request field — see specs/API-CONTRACT.md.
export const customerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.email('Invalid email address'),
  phone: z.string().trim().min(1, 'Phone is required'),
})

export type CustomerDraft = z.infer<typeof customerSchema>

// Mirrors POST /transactions' `delivery` request field — see specs/API-CONTRACT.md.
export const deliverySchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  city: z.string().trim().min(1, 'City is required'),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export type DeliveryDraft = z.infer<typeof deliverySchema>
