import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { persistReducer, persistStore } from 'redux-persist'
import { api } from '../features/checkout/api'
import checkoutReducer from '../features/checkout/checkoutSlice'
import storage from './storage'

const rootReducer = combineReducers({
  checkout: checkoutReducer,
  [api.reducerPath]: api.reducer,
})

// Only `checkout` is persisted. Card data never enters this slice in the first
// place (it lives in PaymentModal's local react-hook-form state and is discarded
// once tokenized) — see ARD.md/TDD.md — so persisting the whole slice by key is
// safe, no per-field allowlist needed. The `api` cache is never persisted —
// it's meant to be refetched, not restored stale.
const persistedReducer = persistReducer(
  { key: 'checkout-gateway-test', storage, whitelist: ['checkout'] },
  rootReducer,
)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist's own actions carry non-serializable internals; ignoring
      // them is the documented way to use it with RTK's serializableCheck.
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/REGISTER',
        ],
      },
    }).concat(api.middleware),
})

// Enables RTK Query's refetchOnFocus/refetchOnReconnect behaviors.
setupListeners(store.dispatch)

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = typeof store.dispatch
