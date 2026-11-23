/**
 * Seed accounts shown on the login page in mock mode. Kept separate from
 * src/mocks/ so the login page never pulls mock code into the production bundle.
 * Must match the seed in src/mocks/db.ts.
 */
export const SEED_ACCOUNTS = [
  'alice@test.com',
  'bob@test.com',
  'carol@test.com',
  'dave@test.com',
] as const

export const SEED_ACCOUNT_PASSWORD = 'password123'
