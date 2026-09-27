import '@testing-library/jest-dom'
// jsdom doesn't implement the Fetch API (Request/Headers/Response). RTK
// Query's fetchBaseQuery constructs a real `Request` internally, and this
// polyfill (unlike Node's own global fetch) resolves relative URLs against
// jsdom's fake document location — matching how a real browser would.
import 'whatwg-fetch'
