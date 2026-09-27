import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { persistor, store } from './app/store'

// Placeholder shell, proving the store/persist/render chain works end to end.
// Screens (ProductPage, ...) replace this in later tasks — see
// frontend/specs/TDD.md.
function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <main className="flex min-h-svh items-center justify-center">
          <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
        </main>
      </PersistGate>
    </Provider>
  )
}

export default App
