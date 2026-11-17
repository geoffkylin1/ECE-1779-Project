import { ApiError } from '../api/client'

/** User-facing message for any thrown value. ApiError.detail is always a string. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError && err.detail) {
    return err.detail
  }
  return fallback
}
