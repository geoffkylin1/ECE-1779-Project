import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** Browser mock API, started from main.tsx when VITE_USE_MOCK === "true". */
export const worker = setupWorker(...handlers)
