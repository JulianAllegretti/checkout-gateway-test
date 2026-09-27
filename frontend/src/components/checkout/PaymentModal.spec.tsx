import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import checkoutReducer from '../../features/checkout/checkoutSlice'
import { getAcceptanceToken, tokenizeCard } from '../../lib/gatewayClient'
import { PaymentModal, type PaymentSecrets } from './PaymentModal'

jest.mock('../../lib/gatewayClient')

const mockedTokenizeCard = tokenizeCard as jest.Mock
const mockedGetAcceptanceToken = getAcceptanceToken as jest.Mock

const validCard = {
  number: '4111 1111 1111 1111',
  expiry: '12/30',
  cvc: '123',
  cardholderName: 'Jane Doe',
}
const validCustomer = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+573001234567',
}
const validDelivery = { address: 'Calle 123 #45-67', city: 'Bogotá' }

function renderModal(
  onSubmitted: (secrets: PaymentSecrets) => void = jest.fn(),
) {
  const store = configureStore({ reducer: { checkout: checkoutReducer } })
  render(
    <Provider store={store}>
      <PaymentModal onSubmitted={onSubmitted} />
    </Provider>,
  )
  return store
}

// Fields are keyed by their input `id` (a dot-path like "card.number"),
// matching react-hook-form's registered field names one to one.
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Record<string, string> = {},
) {
  const values: Record<string, string> = {
    'card.number': validCard.number,
    'card.expiry': validCard.expiry,
    'card.cvc': validCard.cvc,
    'card.cardholderName': validCard.cardholderName,
    'customer.firstName': validCustomer.firstName,
    'customer.lastName': validCustomer.lastName,
    'customer.email': validCustomer.email,
    'customer.phone': validCustomer.phone,
    'delivery.address': validDelivery.address,
    'delivery.city': validDelivery.city,
    ...overrides,
  }
  for (const [id, value] of Object.entries(values)) {
    if (!value) continue // an override of '' means "leave this field blank"
    const input = document.getElementById(id)
    if (input) await user.type(input, value)
  }
}

describe('PaymentModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('is not dismissible — the checkout flow is strictly forward-only', async () => {
    const user = userEvent.setup()
    const store = renderModal()

    await user.keyboard('{Escape}')

    expect(store.getState().checkout.step).toBe(1)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('shows the detected card brand as the number is typed', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText('Card number'), '4111111111111111')

    expect(screen.getByText('VISA')).toBeInTheDocument()
  })

  it('tokenizes the card, fetches the acceptance token, and advances to step 3 on a valid submit', async () => {
    const user = userEvent.setup()
    mockedTokenizeCard.mockResolvedValue({
      cardToken: 'tok_test_1',
      brand: 'VISA',
      last4: '1111',
    })
    mockedGetAcceptanceToken.mockResolvedValue('accept_123')
    const onSubmitted = jest.fn()
    const store = renderModal(onSubmitted)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Continue')).toBeEnabled()
    expect(onSubmitted).toHaveBeenCalledWith({
      cardToken: 'tok_test_1',
      cardBrand: 'VISA',
      cardLast4: '1111',
      paymentAcceptanceToken: 'accept_123',
    })
    expect(mockedTokenizeCard).toHaveBeenCalledWith({
      number: '4111111111111111',
      expiry: '12/30',
      cvc: '123',
      cardholderName: 'Jane Doe',
    })
    expect(store.getState().checkout.step).toBe(3)
    expect(store.getState().checkout.customerDraft).toEqual(validCustomer)
    expect(store.getState().checkout.deliveryDraft).toEqual({
      ...validDelivery,
      region: '',
      postalCode: '',
      notes: '',
    })
  })

  it('shows a generic error and does not advance when the gateway call fails', async () => {
    const user = userEvent.setup()
    mockedTokenizeCard.mockRejectedValue(new Error('network down'))
    mockedGetAcceptanceToken.mockResolvedValue('accept_123')
    const onSubmitted = jest.fn()
    const store = renderModal(onSubmitted)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not validate your card',
    )
    expect(onSubmitted).not.toHaveBeenCalled()
    expect(store.getState().checkout.step).toBe(1)
  })

  it.each([
    ['card.number', '123', 'Card number must have between 13 and 19 digits'],
    ['card.expiry', '13/30', 'Expiry must be in MM/YY format'],
    ['card.cvc', '12', 'CVC must be 3 digits'],
    ['card.cardholderName', '', 'Cardholder name is required'],
    ['customer.firstName', '', 'First name is required'],
    ['customer.lastName', '', 'Last name is required'],
    ['customer.email', 'not-an-email', 'Invalid email address'],
    ['customer.phone', '', 'Phone is required'],
    ['delivery.address', '', 'Address is required'],
    ['delivery.city', '', 'City is required'],
  ])(
    'shows a validation error when %s is invalid',
    async (field, value, expectedMessage) => {
      const user = userEvent.setup()
      const onSubmitted = jest.fn()
      renderModal(onSubmitted)

      await fillForm(user, { [field]: value })
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument()
      expect(mockedTokenizeCard).not.toHaveBeenCalled()
      expect(onSubmitted).not.toHaveBeenCalled()
    },
  )
})
