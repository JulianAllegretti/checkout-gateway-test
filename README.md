# Checkout Gateway Test

A checkout flow where a customer pays for a product by credit card through an
external payment gateway (sandbox integration). Fullstack take-home test.

## Stack

- **Frontend**: React (SPA) + Redux
- **Backend**: NestJS, arquitectura hexagonal (Ports & Adapters) + Railway Oriented
  Programming (`neverthrow`)
- **DB**: PostgreSQL
- **Infra**: Terraform, AWS (EC2 + Docker Compose, S3 + CloudFront)
- **Observabilidad**: Sentry + logs estructurados (pino)

## Documentation

- [PRD](specs/PRD.md) — functional and business requirements
- [ADR 0001 — Architecture overview](specs/decisions/0001-architecture-overview.md)
- [API contract](specs/API-CONTRACT.md)
- [Data model](specs/DATA-MODEL.md)
- [ARD — Architecture reference](specs/ARD.md)
- Per-app specs/TDD/tasks: [backend](backend/specs/), [frontend](frontend/specs/), [infra](infra/specs/)

## Local development

_Pending — documented once `docker-compose.yml` is ready._

## Tests and coverage

_Pending._

## Deployment

_Pending — link to the app deployed on AWS._

## API documentation

Interactive Swagger UI, generated directly from the backend's DTOs and
controllers (not hand-maintained): once the backend is running, visit
`/api/docs` (e.g. `http://localhost:3000/api/docs`). The raw OpenAPI JSON is at
`/api/docs-json`. See [API-CONTRACT.md](specs/API-CONTRACT.md) for the
narrative version (error codes, business rules, idempotency).
