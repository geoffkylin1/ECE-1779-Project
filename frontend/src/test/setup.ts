import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { resetDb } from '../mocks/db'
import { server } from '../mocks/node'

// The mock API answers every request; anything unmocked fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

beforeEach(() => {
  resetDb() // every test starts from the clean seed
  localStorage.clear()
  // jsdom can't navigate; tests that care about the 401 redirect install a spy.
  setUnauthorizedHandler(() => {})
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
