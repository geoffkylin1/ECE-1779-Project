import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { LocationProbe } from './LocationProbe'

/** Render the full app (routes + AuthProvider) at `path`, with a userEvent instance. */
export function renderApp(path = '/') {
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
  return {
    user,
    ...result,
    /** Current router pathname. */
    pathname: () => screen.getByTestId('location').textContent,
  }
}
