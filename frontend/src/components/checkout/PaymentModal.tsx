import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useDispatch } from 'react-redux'
import { z } from 'zod'
import { tokenizeCard } from '../../lib/gatewayClient'
import { useGetAcceptanceTokensQuery } from '../../features/checkout/api'
import { customerInfoSubmitted } from '../../features/checkout/checkoutSlice'
import {
  cardSchema,
  customerSchema,
  deliverySchema,
  type CardBrand,
} from '../../features/checkout/schemas'
import { CardForm } from './CardForm'
import { DeliveryForm } from './DeliveryForm'

// One combined schema so a single react-hook-form instance/submit drives the
// whole modal, while still matching the {customer, delivery} shape
// checkoutSlice's customerInfoSubmitted expects (no reshaping at submit
// time). Card data stays out of Redux — see below.
const paymentFormSchema = z.object({
  card: cardSchema,
  customer: customerSchema,
  delivery: deliverySchema,
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export interface PaymentSecrets {
  cardToken: string
  cardBrand: CardBrand | null
  cardLast4: string
  paymentAcceptanceToken: string
  personalDataAuthToken: string
}

export interface PaymentModalProps {
  // Card token/acceptance token are handed up to a plain prop callback, not
  // dispatched to Redux — they're used once (screen 3's "Pay" button) and
  // never need to survive a refresh. See ARD.md/TDD.md.
  onSubmitted: (secrets: PaymentSecrets) => void
}

export function PaymentModal({ onSubmitted }: PaymentModalProps) {
  const dispatch = useDispatch()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false)
  const {
    data: acceptanceTokens,
    isLoading: acceptanceTokensLoading,
    isError: acceptanceTokensErrored,
    refetch: refetchAcceptanceTokens,
  } = useGetAcceptanceTokensQuery()
  const methods = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      card: { number: '', expiry: '', cvc: '', cardholderName: '' },
      customer: { firstName: '', lastName: '', email: '', phone: '' },
      delivery: {
        address: '',
        city: '',
        region: '',
        postalCode: '',
        notes: '',
      },
    },
  })
  const { handleSubmit, formState } = methods

  async function onSubmit(values: PaymentFormValues) {
    // Guarded defensively — the submit button is already disabled until both
    // are true, but TypeScript can't see that from here.
    if (!acceptanceTokens) return

    setSubmitError(null)
    try {
      const tokenized = await tokenizeCard(values.card)
      onSubmitted({
        cardToken: tokenized.cardToken,
        cardBrand: tokenized.brand,
        cardLast4: tokenized.last4,
        paymentAcceptanceToken: acceptanceTokens.termsToken,
        personalDataAuthToken: acceptanceTokens.personalDataToken,
      })
      dispatch(
        customerInfoSubmitted({
          customer: values.customer,
          delivery: values.delivery,
        }),
      )
    } catch {
      setSubmitError(
        'We could not validate your card. Please check the details and try again.',
      )
    }
  }

  const canSubmit =
    !acceptanceTokensLoading &&
    !acceptanceTokensErrored &&
    termsAccepted &&
    personalDataAccepted &&
    !formState.isSubmitting

  return (
    <Dialog open onClose={() => {}} className="relative z-10">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      {/* The outer layer is the one that scrolls (min-h-full lets the inner
          flex box grow past the viewport instead of being clipped by it) —
          a fixed, centered flex container can't be scrolled into on a short
          viewport, which left "Continue" unreachable on mobile once the
          form's fields exceeded the screen height. */}
      <div className="fixed inset-0 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md space-y-4 rounded-lg bg-white p-6">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Card & delivery details
            </DialogTitle>
            <FormProvider {...methods}>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
                noValidate
              >
                <CardForm />
                <DeliveryForm />

                <fieldset className="space-y-2">
                  <legend className="mb-1 font-medium text-gray-900">
                    Consent
                  </legend>
                  {acceptanceTokensLoading && (
                    <p className="text-sm text-gray-500">Loading terms...</p>
                  )}
                  {acceptanceTokensErrored && (
                    <div role="alert" className="text-sm text-red-600">
                      <p>Could not load the terms and conditions.</p>
                      <button
                        type="button"
                        onClick={() => refetchAcceptanceTokens()}
                        className="font-medium underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {acceptanceTokens && (
                    <>
                      <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                        />
                        <span>
                          I accept the{' '}
                          <a
                            href={acceptanceTokens.termsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            terms and conditions
                          </a>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={personalDataAccepted}
                          onChange={(e) =>
                            setPersonalDataAccepted(e.target.checked)
                          }
                        />
                        <span>
                          I authorize the{' '}
                          <a
                            href={acceptanceTokens.personalDataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            handling of my personal data
                          </a>
                        </span>
                      </label>
                    </>
                  )}
                </fieldset>

                {submitError && (
                  <p role="alert" className="text-sm text-red-600">
                    {submitError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {formState.isSubmitting ? 'Validating...' : 'Continue'}
                </button>
              </form>
            </FormProvider>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
