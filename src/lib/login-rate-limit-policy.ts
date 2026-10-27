import 'server-only'
import { createHash } from 'node:crypto'

export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_IP_LIMIT = 30
export const LOGIN_PAIR_LIMIT = 5

export function loginBucketKey(
  scope:
    | 'ip'
    | 'cpf-ip'
    | 'password-reset-request'
    | 'password-reset-complete'
    | 'password-reset-cpf',
  ...parts: string[]
): string {
  return createHash('sha256')
    .update(JSON.stringify([scope, ...parts]))
    .digest('hex')
}

export function getLoginWindow(now: Date) {
  // Janelas fixas de 15 minutos: o bloqueio não se prolonga a cada tentativa.
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS,
  )
  return {
    windowStartedAt,
    expiresAt: new Date(windowStartedAt.getTime() + LOGIN_WINDOW_MS),
  }
}

export function activeBucketCount(
  bucket: { count: number; windowStartedAt: Date } | undefined,
  windowStartedAt: Date,
): number {
  return bucket?.windowStartedAt.getTime() === windowStartedAt.getTime()
    ? bucket.count
    : 0
}
