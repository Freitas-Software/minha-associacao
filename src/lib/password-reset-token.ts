import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

export const PASSWORD_RESET_DURATION_MS = 30 * 60 * 1000
export const PASSWORD_RESET_RESEND_INTERVAL_MS = 60 * 1000

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createPasswordResetToken(now = new Date()) {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_DURATION_MS),
  }
}
