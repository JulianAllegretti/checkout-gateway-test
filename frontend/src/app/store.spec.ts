import { api } from '../features/checkout/api'
import { initialState } from '../features/checkout/checkoutSlice'
import { persistor, store } from './store'

describe('store', () => {
  it('wires the checkout reducer under the checkout key', () => {
    expect(store.getState().checkout).toEqual(initialState)
  })

  it('wires the RTK Query reducer under its own key', () => {
    expect(store.getState()[api.reducerPath]).toBeDefined()
  })

  it('wires a persistor for the store', () => {
    expect(persistor.getState()).toBeDefined()
  })
})
