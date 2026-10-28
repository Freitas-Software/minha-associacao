import assert from 'node:assert/strict'
import test from 'node:test'
import { createInviteToken, hashInviteToken } from './invite-token'

test('invite token has 256 bits and is stored only as a hash', () => {
  const generated = createInviteToken()

  assert.match(generated.token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(generated.tokenHash, hashInviteToken(generated.token))
  assert.match(generated.tokenHash, /^[a-f0-9]{64}$/)
  assert.notEqual(generated.token, generated.tokenHash)
})

test('different invocations generate different tokens', () => {
  const first = createInviteToken()
  const second = createInviteToken()

  assert.notEqual(first.token, second.token)
  assert.notEqual(first.tokenHash, second.tokenHash)
})
