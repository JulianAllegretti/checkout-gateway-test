import * as Sentry from '@sentry/react'
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
import { reloadPage } from './lib/reload'
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

// Catches an unexpected render crash from any screen (a bug, not a modeled
// error case — those are handled per-screen, see SummaryBackdrop/
// FinalStatusPage) and reports it to Sentry instead of taking down the
// whole page. A reload is the only safe recovery: the tree that crashed
// might have done so mid-update, so resuming it in place isn't trustworthy.
function ErrorFallback() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-gray-500">
        Something went wrong. Please reload the page.
      </p>
      <button
        type="button"
        onClick={reloadPage}
        className="rounded-lg bg-gray-900 px-4 py-3 font-medium text-white"
      >
        Reload
      </button>
    </main>
  )
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
          <Screens />
        </Sentry.ErrorBoundary>
      </PersistGate>
    </Provider>
  )
}

export default App
