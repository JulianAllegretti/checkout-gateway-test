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
import { getAcceptanceToken, tokenizeCard } from '../../lib/gatewayClient'
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
    setSubmitError(null)
    try {
      const [tokenized, paymentAcceptanceToken] = await Promise.all([
        tokenizeCard(values.card),
        getAcceptanceToken(),
      ])
      onSubmitted({
        cardToken: tokenized.cardToken,
        cardBrand: tokenized.brand,
        cardLast4: tokenized.last4,
        paymentAcceptanceToken,
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

  return (
    <Dialog open onClose={() => {}} className="relative z-10">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
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
              {submitError && (
                <p role="alert" className="text-sm text-red-600">
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {formState.isSubmitting ? 'Validating...' : 'Continue'}
              </button>
            </form>
          </FormProvider>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
