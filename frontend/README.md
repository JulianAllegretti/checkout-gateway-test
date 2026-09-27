# Frontend

React + TypeScript SPA for the checkout flow. Standalone app (own
`package.json`, `Dockerfile`, tests, env vars) — see
[specs/SPEC.md](specs/SPEC.md), [specs/TDD.md](specs/TDD.md) and
[specs/TASKS.md](specs/TASKS.md) for the functional spec, technical design and
implementation plan.

## Stack

- Vite + React + TypeScript
- Redux Toolkit + `redux-persist` (resilient to page refresh mid-checkout)
- TailwindCSS
- `react-hook-form` + `zod`
- Jest + React Testing Library, 80% coverage gate

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the sandbox gateway keys
npm run dev
```

## Tests and coverage

```bash
npm test           # run once
npm run test:cov   # with coverage (gate: 80%)
```

## Build

```bash
npm run build       # tsc -b && vite build, output in dist/
```

The `Dockerfile` here is build-only: it produces `dist/` as a static artifact.
The app is deployed as a static SPA behind CloudFront (see `infra/specs/`), not
run as a container.
