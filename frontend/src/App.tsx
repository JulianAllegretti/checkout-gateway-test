import { Provider, useSelector } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import type { RootState } from './app/store'
import { persistor, store } from './app/store'
import { PaymentModal } from './components/checkout/PaymentModal'
import { ProductPage } from './pages/ProductPage'

// Single route: screens are conditionally rendered from checkoutSlice.step,
// per frontend/specs/TDD.md — there's no router. Exported for direct testing
// of steps that don't have a full store/persist/network chain to boot yet.
export function Screens() {
  const step = useSelector((state: RootState) => state.checkout.step)

  switch (step) {
    case 1:
      return <ProductPage />
    case 2:
      // The card token/acceptance token PaymentModal produces are handed
      // here, not to Redux — screen 3 (task 7) will start holding and
      // consuming them; for now there's nothing downstream to pass them to.
      return <PaymentModal onSubmitted={() => {}} />
    default:
      // Screens 3-5 land in later tasks — see frontend/specs/TASKS.md.
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
