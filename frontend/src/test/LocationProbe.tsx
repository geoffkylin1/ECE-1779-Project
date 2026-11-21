import { useLocation } from 'react-router-dom'

/** Renders the current pathname so tests can assert navigation. */
export function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}
