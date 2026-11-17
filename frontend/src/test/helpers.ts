import { login } from '../api/auth'
import { setToken } from '../api/token'
import { SEED_PASSWORD } from '../mocks/db'

/** Log in as a seed user through the mock API and store the token. */
export async function loginAs(email: string, password = SEED_PASSWORD): Promise<string> {
  const { access_token } = await login({ email, password })
  setToken(access_token)
  return access_token
}
