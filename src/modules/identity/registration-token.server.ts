import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

export const REGISTRATION_TOKEN_TTL_MS = 30 * 60 * 1000
export const REGISTRATION_RESEND_INTERVAL_MS = 60 * 1000

export function hashRegistrationToken(token: string): string {
  return createHash('sha256').update(token, 'utf-8').digest('hex')
}

export function createRegistrationToken(now: Date = new Date()) {
  const token = randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashRegistrationToken(token),
    expiresAt: new Date(now.getTime() + REGISTRATION_TOKEN_TTL_MS),
  }
}
