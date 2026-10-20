import { createHash, randomBytes } from 'node:crypto'
import 'server-only'

export const REGISTRATION_TOKEN_TTL_MS = 30 * 60 * 1000
export const REGISTRATION_RESEND_INTERVAL_MS = 60 * 1000

export function hashRegistrationToken(token: string): string {
  return createHash('sha256').update(token, 'utf-8').digest('hex')
}

export function createRegistrationToken() {
  const token = randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashRegistrationToken(token),
    expiresAt: new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS),
  }
}
