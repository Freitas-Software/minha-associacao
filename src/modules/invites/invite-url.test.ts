import assert from 'node:assert/strict'
import test from 'node:test'
import { inviteAcceptanceUrl } from './invite-url'

test('builds an invite URL with the token', () => {
  const url = inviteAcceptanceUrl('abc', {
    APP_URL: 'https://associae.example',
    NODE_ENV: 'production',
  })

  assert.equal(url, 'https://associae.example/app/convites/aceitar?token=abc')
})

test('requires HTTPS outside local development', () => {
  assert.throws(() =>
    inviteAcceptanceUrl('abc', {
      APP_URL: 'http://associae.example',
      NODE_ENV: 'production',
    }),
  )

  assert.doesNotThrow(() =>
    inviteAcceptanceUrl('abc', {
      APP_URL: 'http://localhost:3000',
      NODE_ENV: 'development',
    }),
  )
})
