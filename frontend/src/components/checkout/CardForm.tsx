import { useFormContext, useWatch } from 'react-hook-form'
import { detectCardBrand } from '../../features/checkout/schemas'
import type { PaymentFormValues } from './PaymentModal'

const BRAND_LABEL: Record<string, string> = {
  VISA: 'VISA',
  MASTERCARD: 'Mastercard',
}

export function CardForm() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<PaymentFormValues>()
  const cardNumber = useWatch({ control, name: 'card.number' })
  const brand = detectCardBrand(cardNumber)

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 font-medium text-gray-900">Card</legend>

      <div>
        <label htmlFor="card.number" className="text-sm text-gray-600">
          Card number
        </label>
        <div className="flex items-center gap-2">
          <input
            id="card.number"
            inputMode="numeric"
            placeholder="4111 1111 1111 1111"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('card.number')}
          />
          {brand && (
            <span className="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
              {BRAND_LABEL[brand]}
            </span>
          )}
        </div>
        {errors.card?.number && (
          <p className="text-sm text-red-600">{errors.card.number.message}</p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="card.expiry" className="text-sm text-gray-600">
            Expiry (MM/YY)
          </label>
          <input
            id="card.expiry"
            placeholder="12/30"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('card.expiry')}
          />
          {errors.card?.expiry && (
            <p className="text-sm text-red-600">{errors.card.expiry.message}</p>
          )}
        </div>
        <div className="flex-1">
          <label htmlFor="card.cvc" className="text-sm text-gray-600">
            CVC
          </label>
          <input
            id="card.cvc"
            inputMode="numeric"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('card.cvc')}
          />
          {errors.card?.cvc && (
            <p className="text-sm text-red-600">{errors.card.cvc.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="card.cardholderName" className="text-sm text-gray-600">
          Cardholder name
        </label>
        <input
          id="card.cardholderName"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          {...register('card.cardholderName')}
        />
        {errors.card?.cardholderName && (
          <p className="text-sm text-red-600">
            {errors.card.cardholderName.message}
          </p>
        )}
      </div>
    </fieldset>
  )
}
