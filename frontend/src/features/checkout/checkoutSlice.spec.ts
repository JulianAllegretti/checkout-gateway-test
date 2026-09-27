import checkoutReducer from './checkoutSlice'

describe('checkoutSlice', () => {
  it('starts as an empty placeholder state', () => {
    expect(checkoutReducer(undefined, { type: '@@INIT' })).toEqual({})
  })
})
