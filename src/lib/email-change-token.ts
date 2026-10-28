import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

export const EMAIL_CHANGE_DURATION_MS = 30 * 60 * 1000
export const EMAIL_CHANGE_RESEND_INTERVAL_MS = 60 * 1000

export function hashEmailChangeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createEmailChangeToken(now = new Date()) {
  const token = randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashEmailChangeToken(token),
    expiresAt: new Date(now.getTime() + EMAIL_CHANGE_DURATION_MS),
  }
}
