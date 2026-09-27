import { persistor, store } from './store'

describe('store', () => {
  it('wires the checkout reducer under the checkout key', () => {
    expect(store.getState().checkout).toEqual({})
  })

  it('wires a persistor for the store', () => {
    expect(persistor.getState()).toBeDefined()
  })
})
