# SplitMate Frontend

React + TypeScript + Vite frontend for SplitMate. Styling is Tailwind CSS, routing is React Router, and the mock API is MSW.

The API contract lives in [`docs/api-contract.md`](../docs/api-contract.md). It is the source of truth for endpoints, field names, status codes and the money format.

## Requirements

- **Node.js ≥ 22.12** (MSW 3 needs it; Node 24 LTS recommended)
- npm (comes with Node)

```bash
node --version   # v22.12.0 or newer
```

## Install

```bash
cd frontend
npm install
```

## Run in mock mode (default, no backend needed)

```bash
npm run dev
```

Open **http://localhost:5173**.

`.env.development` sets `VITE_USE_MOCK=true`. With it on, a [Mock Service Worker](https://mswjs.io/) starts in the browser before the app renders and answers every `/api` request from an in-memory database ([src/mocks/](src/mocks/)). The console logs `[SplitMate] Mock API enabled`.

### Seed data

All seed users have the password **`password123`**.

| User | Email | Groups |
|------|-------|--------|
| Alice (id 1) | alice@test.com | Apartment 4B |
| Bob (id 2) | bob@test.com | Apartment 4B |
| Carol (id 3) | carol@test.com | Apartment 4B |
| Dave (id 4) | dave@test.com | Dave's Trip (**not** in Apartment 4B) |

| Group | id | Join code |
|-------|----|-----------|
| Apartment 4B | 1 | `K7Q2ZP4M` |
| Dave's Trip | 2 | `DAVETRIP` |

Apartment 4B also has 4 expenses and 1 settlement. Use Dave to test cross-group access (expect 403).

Mock tokens look like `mock-token-<userId>`. The mock database lives in memory, so reloading the page resets it to the seed. A stored seed-user token stays valid across reloads.

## Run against a real backend

When mock mode is off, the Vite dev server proxies `/api/*` to **http://localhost:8000**.

1. Start the FastAPI backend on port 8000.
2. Turn mock mode off, either for one run:
   ```bash
   VITE_USE_MOCK=false npm run dev
   ```
   or permanently on your machine by creating `frontend/.env.development.local` (git-ignored):
   ```
   VITE_USE_MOCK=false
   ```
3. If the backend is on a different host or port:
   ```bash
   API_PROXY_TARGET=http://localhost:9000 VITE_USE_MOCK=false npm run dev
   ```

> Windows (PowerShell): `$env:VITE_USE_MOCK="false"; npm run dev`, or use the `.env.development.local` file.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Type-check, then build the production bundle to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with oxlint (warnings fail) |
| `npm run typecheck` | TypeScript type-check only |

Run all four checks before opening a PR:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Tests

```bash
npm test
```

Tests run in jsdom. The same MSW handlers used in the browser run here through MSW's Node server ([src/mocks/node.ts](src/mocks/node.ts)). Every test starts from a clean seed: [src/test/setup.ts](src/test/setup.ts) calls `resetDb()` and clears `localStorage`. Any request without a matching handler fails the test.

Log in as a seed user in a test:

```ts
import { loginAs } from '../test/helpers'

await loginAs('dave@test.com')
```

## Project layout

```
src/
├── api/        # Typed API client: one function per endpoint
│   ├── types.ts       # Request/response types (money = string, ids = number)
│   ├── client.ts      # fetch wrapper: /api prefix, bearer token, ApiError, 401 → /login
│   ├── token.ts       # Token storage (localStorage)
│   └── auth.ts, groups.ts, expenses.ts, balances.ts, settlements.ts
├── auth/       # AuthProvider, useAuth, ProtectedRoute
├── lib/
│   └── money.ts       # Integer-cent money helpers (never use floats for money)
├── mocks/      # MSW mock backend
│   ├── db.ts          # In-memory DB, seed data, resetDb()
│   ├── handlers.ts    # Whole API contract
│   ├── validation.ts  # 422 checks (mirrors Pydantic)
│   ├── browser.ts     # setupWorker (dev)
│   └── node.ts        # setupServer (tests)
├── pages/      # Route pages (placeholders for now)
├── test/       # Test setup and helpers
├── App.tsx     # Routes
└── main.tsx    # Entry: starts MSW if VITE_USE_MOCK=true, then renders
```

## Conventions

- **Money**: always a string on the wire (`"12.34"`). Do any math in integer cents with `parseCents` / `formatCents` from [src/lib/money.ts](src/lib/money.ts), and use `displayMoney` for UI text. Never call `parseFloat` on money.
- **Errors**: API calls throw `ApiError { status, detail }`, where `detail` is always a string, so you can show it to the user directly.
- **401**: any authenticated call that gets a 401 clears the token and sends the user to `/login`. Login itself does not, so a wrong password stays on the page.
- **Contract changes**: if the backend changes the contract, update `docs/api-contract.md`, then [src/api/types.ts](src/api/types.ts) and [src/mocks/handlers.ts](src/mocks/handlers.ts).
