import { createSlice } from '@reduxjs/toolkit'

// Placeholder slice, just enough to wire the store + redux-persist end to end.
// Replaced with the real state shape (step, productSnapshot, drafts, ...) and
// its reducers/actions in the next task — see frontend/specs/TDD.md.
const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: {},
  reducers: {},
})

export default checkoutSlice.reducer
