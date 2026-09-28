import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev-only: in production the frontend and /api/* share an origin behind
  // CloudFront (see specs/decisions/0001-architecture-overview.md), so
  // fetchBaseQuery's relative '/api/*' calls just work there. Locally the
  // backend runs on its own port, so this proxies the same relative calls to
  // it without any code change between environments.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
      },
    },
  },
})
