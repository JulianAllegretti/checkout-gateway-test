import { useState } from 'react'
import { Provider, useSelector } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import type { RootState } from './app/store'
import { persistor, store } from './app/store'
import {
  PaymentModal,
  type PaymentSecrets,
} from './components/checkout/PaymentModal'
import { SummaryBackdrop } from './components/checkout/SummaryBackdrop'
import { FinalStatusPage } from './pages/FinalStatusPage'
import { ProductPage } from './pages/ProductPage'

// Single route: screens are conditionally rendered from checkoutSlice.step,
// per frontend/specs/TDD.md — there's no router. Exported for direct testing
// of steps that don't have a full store/persist/network chain to boot yet.
export function Screens() {
  const step = useSelector((state: RootState) => state.checkout.step)
  // The card token/acceptance token PaymentModal produces are held here, not
  // in Redux — they're used once (screen 3's "Pay" button) and never need to
  // survive a refresh. See PaymentModal's own comment and ARD.md/TDD.md.
  const [paymentSecrets, setPaymentSecrets] = useState<PaymentSecrets | null>(
    null,
  )

  switch (step) {
    case 1:
      return <ProductPage />
    case 2:
      return <PaymentModal onSubmitted={setPaymentSecrets} />
    case 3:
      // A refresh loses paymentSecrets (it was never persisted, by design).
      // Rather than get stuck with no card token to charge, fall back to
      // redoing the card step — checkoutSlice's step itself still only ever
      // advances, this is purely a local rendering recovery.
      return paymentSecrets ? (
        <SummaryBackdrop paymentSecrets={paymentSecrets} />
      ) : (
        <PaymentModal onSubmitted={setPaymentSecrets} />
      )
    case 4:
      return <FinalStatusPage />
    default:
      // Screen 5 lands in a later task — see frontend/specs/TASKS.md.
      return null
  }
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Screens />
      </PersistGate>
    </Provider>
  )
}

export default App
