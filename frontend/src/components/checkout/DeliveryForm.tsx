import { useFormContext } from 'react-hook-form'
import type { PaymentFormValues } from './PaymentModal'

export function DeliveryForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PaymentFormValues>()

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 font-medium text-gray-900">
        Contact & delivery
      </legend>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="customer.firstName" className="text-sm text-gray-600">
            First name
          </label>
          <input
            id="customer.firstName"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('customer.firstName')}
          />
          {errors.customer?.firstName && (
            <p className="text-sm text-red-600">
              {errors.customer.firstName.message}
            </p>
          )}
        </div>
        <div className="flex-1">
          <label htmlFor="customer.lastName" className="text-sm text-gray-600">
            Last name
          </label>
          <input
            id="customer.lastName"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('customer.lastName')}
          />
          {errors.customer?.lastName && (
            <p className="text-sm text-red-600">
              {errors.customer.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="customer.email" className="text-sm text-gray-600">
          Email
        </label>
        <input
          id="customer.email"
          type="email"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          {...register('customer.email')}
        />
        {errors.customer?.email && (
          <p className="text-sm text-red-600">
            {errors.customer.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="customer.phone" className="text-sm text-gray-600">
          Phone
        </label>
        <input
          id="customer.phone"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          {...register('customer.phone')}
        />
        {errors.customer?.phone && (
          <p className="text-sm text-red-600">
            {errors.customer.phone.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="delivery.address" className="text-sm text-gray-600">
          Address
        </label>
        <input
          id="delivery.address"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          {...register('delivery.address')}
        />
        {errors.delivery?.address && (
          <p className="text-sm text-red-600">
            {errors.delivery.address.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="delivery.city" className="text-sm text-gray-600">
            City
          </label>
          <input
            id="delivery.city"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('delivery.city')}
          />
          {errors.delivery?.city && (
            <p className="text-sm text-red-600">
              {errors.delivery.city.message}
            </p>
          )}
        </div>
        <div className="flex-1">
          <label htmlFor="delivery.region" className="text-sm text-gray-600">
            Region (optional)
          </label>
          <input
            id="delivery.region"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            {...register('delivery.region')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="delivery.postalCode" className="text-sm text-gray-600">
          Postal code (optional)
        </label>
        <input
          id="delivery.postalCode"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          {...register('delivery.postalCode')}
        />
      </div>

      <div>
        <label htmlFor="delivery.notes" className="text-sm text-gray-600">
          Delivery notes (optional)
        </label>
        <input
          id="delivery.notes"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          {...register('delivery.notes')}
        />
      </div>
    </fieldset>
  )
}
