# syntax=docker/dockerfile:1
# Caddy image with the React production build baked in.
# Build from the repository root:
#   docker build --file deploy/caddy/Dockerfile .

FROM node:22-alpine AS frontend-build

WORKDIR /frontend

# Install dependencies first so they are cached until the lockfile changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

# Production build: VITE_USE_MOCK must be unset (the mock API is dev-only).
# Fail if any mock code or seed data ends up in the output.
RUN unset VITE_USE_MOCK \
    && npm run build \
    && if grep -rqE 'mockServiceWorker|Mock Service Worker|mock-token-|setupWorker|@test\.com' dist; then \
         echo "Mock code found in frontend/dist; refusing to build a production image." >&2; \
         grep -rlE 'mockServiceWorker|Mock Service Worker|mock-token-|setupWorker|@test\.com' dist >&2; \
         exit 1; \
       fi

FROM caddy:2-alpine AS runtime

COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /frontend/dist /srv
