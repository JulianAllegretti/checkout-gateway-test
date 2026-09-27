import {
  cardSchema,
  customerSchema,
  deliverySchema,
  detectCardBrand,
} from './schemas'

describe('detectCardBrand', () => {
  it.each([
    ['4111111111111111', 'VISA'],
    ['4012 8888 8888 1881', 'VISA'],
    ['5555555555554444', 'MASTERCARD'],
    ['5105105105105100', 'MASTERCARD'],
    ['2223003122003222', 'MASTERCARD'], // new-range MasterCard (2221-2720)
    ['2720999999999999', 'MASTERCARD'], // upper bound of the new range
    ['2221000000000000', 'MASTERCARD'], // lower bound of the new range
    ['378282246310005', null], // Amex — unsupported
    ['6011111111111117', null], // Discover — unsupported
    ['', null],
  ])('detects %s as %s', (number, expected) => {
    expect(detectCardBrand(number)).toBe(expected)
  })
})

describe('cardSchema', () => {
  const validCard = {
    number: '4111 1111 1111 1111',
    expiry: '12/99',
    cvc: '123',
    cardholderName: 'Jane Doe',
  }

  it('accepts a valid VISA card and strips non-digits from the number', () => {
    const result = cardSchema.safeParse(validCard)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.number).toBe('4111111111111111')
    }
  })

  it('accepts a valid MasterCard', () => {
    const result = cardSchema.safeParse({
      ...validCard,
      number: '5555555555554444',
    })
    expect(result.success).toBe(true)
  })

  it.each([
    ['too short', { ...validCard, number: '41111111111' }],
    ['fails the Luhn check', { ...validCard, number: '4111111111111112' }],
    ['unsupported brand (Amex)', { ...validCard, number: '378282246310005' }],
    ['expired', { ...validCard, expiry: '01/20' }],
    ['malformed expiry', { ...validCard, expiry: '13/99' }],
    ['cvc too short', { ...validCard, cvc: '12' }],
    ['cvc has letters', { ...validCard, cvc: 'abc' }],
    ['blank cardholder name', { ...validCard, cardholderName: '   ' }],
  ])('rejects a card that is %s', (_description, card) => {
    expect(cardSchema.safeParse(card).success).toBe(false)
  })
})

describe('customerSchema', () => {
  const validCustomer = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+573001234567',
  }

  it('accepts a valid customer', () => {
    expect(customerSchema.safeParse(validCustomer).success).toBe(true)
  })

  it.each([
    ['firstName', ''],
    ['lastName', ''],
    ['email', 'not-an-email'],
    ['phone', ''],
  ])('rejects a blank/invalid %s', (field, value) => {
    const result = customerSchema.safeParse({
      ...validCustomer,
      [field]: value,
    })
    expect(result.success).toBe(false)
  })
})

describe('deliverySchema', () => {
  const validDelivery = { address: 'Calle 123 #45-67', city: 'Bogotá' }

  it('accepts the required fields with the optional ones omitted', () => {
    expect(deliverySchema.safeParse(validDelivery).success).toBe(true)
  })

  it('accepts the optional fields when present', () => {
    const result = deliverySchema.safeParse({
      ...validDelivery,
      region: 'Cundinamarca',
      postalCode: '110111',
      notes: 'Apt 4B',
    })
    expect(result.success).toBe(true)
  })

  it.each([
    ['address', ''],
    ['city', ''],
  ])('rejects a blank %s', (field, value) => {
    expect(
      deliverySchema.safeParse({ ...validDelivery, [field]: value }).success,
    ).toBe(false)
  })
})
