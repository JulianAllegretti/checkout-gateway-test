import type { WebStorage } from 'redux-persist/es/types'

// A minimal reimplementation of `redux-persist/lib/storage`'s localStorage
// engine (which is exactly this — a Promise-wrapped `window.localStorage`),
// used instead of importing that subpath directly: Vite's dependency
// pre-bundler mishandles its doubly-nested CJS default export, resolving it
// to `{ default: <storage> }` instead of `<storage>` and breaking
// persistence with "storage.getItem is not a function". This sidesteps that
// bundler bug entirely — nothing here needs redux-persist's own storage code.
const storage: WebStorage = {
  getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key, value) =>
    Promise.resolve(window.localStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(window.localStorage.removeItem(key)),
}

export default storage
