# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js ./
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/sync-contract.cjs ./scripts/sync-contract.cjs
COPY hash-timestamp/package.json hash-timestamp/Anchor.toml ./hash-timestamp/
COPY hash-timestamp/app/sdk/ ./hash-timestamp/app/sdk/
COPY hash-timestamp/programs/hash-timestamp/Cargo.toml ./hash-timestamp/programs/hash-timestamp/Cargo.toml
COPY hash-timestamp/scripts/check-idl.cjs ./hash-timestamp/scripts/check-idl.cjs
COPY hash-timestamp/tests/fixtures/idl.json ./hash-timestamp/tests/fixtures/idl.json
ARG VITE_SOLANA_NETWORK=localnet
ARG VITE_SOLANA_RPC_URL=
ENV VITE_SOLANA_NETWORK=${VITE_SOLANA_NETWORK} VITE_SOLANA_RPC_URL=${VITE_SOLANA_RPC_URL}
RUN npm run build

FROM nginx:1.28-alpine AS frontend
COPY infra/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
