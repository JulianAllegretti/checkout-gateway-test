# Checkout Gateway Test

Checkout de un producto pagado con tarjeta de crédito vía una pasarela de pagos
externa (integración en modo sandbox). Prueba técnica fullstack.

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
- API contract: _pending_ (`specs/API-CONTRACT.md`)
- Data model: _pending_

## Local development

_Pending — documented once `docker-compose.yml` is ready._

## Tests and coverage

_Pending._

## Deployment

_Pending — link to the app deployed on AWS._

## API collection

_Pending — public Postman collection / Swagger._
