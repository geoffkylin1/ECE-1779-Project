import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

/** Start the MSW mock API before the first render when VITE_USE_MOCK=true. */
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK !== 'true') {
    return
  }
  const { worker } = await import('./mocks/browser')
  // Only /api is mocked; let Vite's own module/asset requests through silently.
  await worker.start({ onUnhandledFrame: 'bypass' })
  console.info('[SplitMate] Mock API enabled (VITE_USE_MOCK=true)')
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
