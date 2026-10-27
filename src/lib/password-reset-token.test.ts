import assert from 'node:assert/strict'
import test from 'node:test'
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@/app/(application)/app/(auth)/schema'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_DURATION_MS,
} from './password-reset-token'
import { passwordResetUrl } from './password-reset-url'

test('token aleatório de 256 bits, hash SHA-256 e validade exata de 30 minutos', () => {
  const now = new Date('2026-10-22T12:00:00Z')
  const tokens = Array.from({ length: 100 }, () =>
    createPasswordResetToken(now),
  )
  assert.equal(new Set(tokens.map(value => value.token)).size, tokens.length)
  for (const value of tokens) {
    assert.match(value.token, /^[A-Za-z0-9_-]{43}$/)
    assert.match(value.tokenHash, /^[a-f0-9]{64}$/)
    assert.notEqual(value.tokenHash, value.token)
    assert.equal(hashPasswordResetToken(value.token), value.tokenHash)
    assert.equal(
      value.expiresAt.getTime() - now.getTime(),
      PASSWORD_RESET_DURATION_MS,
    )
  }
})

test('recuperação normaliza CPF e rejeita documento inválido', () => {
  assert.equal(
    requestPasswordResetSchema.parse({ documentNumber: '529.982.247-25' })
      .documentNumber,
    '52998224725',
  )
  assert.equal(
    requestPasswordResetSchema.safeParse({ documentNumber: '11111111111' })
      .success,
    false,
  )
})

test('senha preserva espaços e respeita limites de 15 a 128 caracteres', () => {
  const token = createPasswordResetToken().token
  for (const length of [14, 15, 128, 129])
    assert.equal(
      resetPasswordSchema.safeParse({ token, password: 'x'.repeat(length) })
        .success,
      length >= 15 && length <= 128,
    )
  const password = '  minha frase com espaços  '
  assert.equal(
    resetPasswordSchema.parse({ token, password }).password,
    password,
  )
  assert.equal(
    resetPasswordSchema.safeParse({ token: 'inválido', password }).success,
    false,
  )
})

test('URL usa origem configurada e exige HTTPS fora do localhost de desenvolvimento', () => {
  assert.equal(
    passwordResetUrl('abc', {
      NODE_ENV: 'production',
      APP_URL: 'https://example.test/base?ignorado=1',
    }),
    'https://example.test/app/redefinir-senha?token=abc',
  )
  for (const APP_URL of [
    'http://example.test',
    'https://user:password@example.test',
    'javascript:alert(1)',
    '',
  ])
    assert.throws(() =>
      passwordResetUrl('abc', { NODE_ENV: 'production', APP_URL }),
    )
  assert.equal(
    passwordResetUrl('abc', {
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
    }),
    'http://localhost:3000/app/redefinir-senha?token=abc',
  )
})
