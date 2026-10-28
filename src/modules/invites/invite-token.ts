import { createHash, randomBytes } from 'node:crypto'
import { INVITE_TOKEN_BYTES } from './invite-policy'

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function createInviteToken() {
  const token = randomBytes(INVITE_TOKEN_BYTES).toString('base64url')

  return {
    token,
    tokenHash: hashInviteToken(token),
  }
}
