# syntax=docker/dockerfile:1

# Build-only image: it produces /app/dist as a static build artifact. The
# frontend is a SPA served from S3 + CloudFront (see infra/specs), never run
# as a long-lived container — there is no runtime stage here on purpose.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
