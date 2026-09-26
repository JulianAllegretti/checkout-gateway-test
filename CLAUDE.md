# Project context for Claude

Fullstack take-home test (job interview process): a checkout flow where a customer
pays for a product by credit card through an external payment gateway (sandbox
only).

**Read these first, in order:**
1. [specs/PRD.md](specs/PRD.md) — functional requirements, business flow, rubric.
2. [specs/decisions/0001-architecture-overview.md](specs/decisions/0001-architecture-overview.md)
   — architecture decisions already made (monorepo layout, hexagonal backend with
   Railway Oriented Programming, EC2 + Docker Compose, card tokenization approach,
   transaction state machine). Don't re-litigate these unless the user explicitly
   asks to.

**Hard rules from the test (don't violate these):**
- This is a **public** GitHub repo. Never mention the payment gateway/company name
  anywhere (code, filenames, commit messages, README). Use generic terms
  (`PaymentGateway`, `PAYMENT_API_URL`).
- Never commit real API keys/secrets. Only `.env.example` goes in the repo.
- Commit frequently with real incremental progress — a repo with no visible history
  voids the test as fraud.
- Frontend: React + Redux only. Backend: NestJS only. No other frameworks.

**Language convention:** everything that goes into the repo (code, comments, specs,
README, commit messages, PR descriptions) is written in **English**. Conversation
with the user is in **Spanish** — this file and other repo content should stay in
English regardless of the conversation language.

**Current status:** specs scaffolding done (PRD + ADR 0001). Not yet started:
`specs/API-CONTRACT.md`, data model doc, `specs/ARD.md`, per-app specs
(frontend/backend/infra), then implementation (suggested order: backend domain +
use cases with ROP + tests → frontend → deploy, with CI/coverage wired from day one).
