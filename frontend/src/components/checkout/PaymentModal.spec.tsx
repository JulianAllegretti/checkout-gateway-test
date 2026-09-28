import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { useGetAcceptanceTokensQuery } from '../../features/checkout/api'
import checkoutReducer from '../../features/checkout/checkoutSlice'
import { tokenizeCard } from '../../lib/gatewayClient'
import { PaymentModal, type PaymentSecrets } from './PaymentModal'

jest.mock('../../lib/gatewayClient')
jest.mock('../../features/checkout/api')

const mockedTokenizeCard = tokenizeCard as jest.Mock
const mockedUseGetAcceptanceTokensQuery =
  useGetAcceptanceTokensQuery as jest.Mock

const acceptanceTokens = {
  termsToken: 'accept_terms_123',
  termsUrl: 'https://example.com/terms.pdf',
  personalDataToken: 'accept_personal_123',
  personalDataUrl: 'https://example.com/personal-data.pdf',
}

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

async function acceptAllConsent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('checkbox', { name: /terms and conditions/ }),
  )
  await user.click(
    screen.getByRole('checkbox', { name: /handling of my personal data/ }),
  )
}

describe('PaymentModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseGetAcceptanceTokensQuery.mockReturnValue({
      data: acceptanceTokens,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })
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

  it('disables Continue until both consent checkboxes are checked', async () => {
    const user = userEvent.setup()
    renderModal()
    await fillForm(user)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', { name: /terms and conditions/ }),
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', { name: /handling of my personal data/ }),
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('links each checkbox to its own contract permalink', () => {
    renderModal()

    expect(
      screen.getByRole('link', { name: 'terms and conditions' }),
    ).toHaveAttribute('href', acceptanceTokens.termsUrl)
    expect(
      screen.getByRole('link', { name: 'handling of my personal data' }),
    ).toHaveAttribute('href', acceptanceTokens.personalDataUrl)
  })

  it('disables Continue and shows a loading state while the consent tokens are being fetched', () => {
    mockedUseGetAcceptanceTokensQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    })
    renderModal()

    expect(screen.getByText('Loading terms...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('shows a retry option and keeps Continue disabled when the consent tokens fail to load', async () => {
    const user = userEvent.setup()
    const refetch = jest.fn()
    mockedUseGetAcceptanceTokensQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    })
    renderModal()

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(refetch).toHaveBeenCalled()
  })

  it('tokenizes the card and advances to step 3 on a valid submit', async () => {
    const user = userEvent.setup()
    mockedTokenizeCard.mockResolvedValue({
      cardToken: 'tok_test_1',
      brand: 'VISA',
      last4: '1111',
    })
    const onSubmitted = jest.fn()
    const store = renderModal(onSubmitted)

    await fillForm(user)
    await acceptAllConsent(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Continue')).toBeEnabled()
    expect(onSubmitted).toHaveBeenCalledWith({
      cardToken: 'tok_test_1',
      cardBrand: 'VISA',
      cardLast4: '1111',
      paymentAcceptanceToken: 'accept_terms_123',
      personalDataAuthToken: 'accept_personal_123',
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
    const onSubmitted = jest.fn()
    const store = renderModal(onSubmitted)

    await fillForm(user)
    await acceptAllConsent(user)
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
      await acceptAllConsent(user)
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument()
      expect(mockedTokenizeCard).not.toHaveBeenCalled()
      expect(onSubmitted).not.toHaveBeenCalled()
    },
  )
})
