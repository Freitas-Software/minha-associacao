import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeClientIp, resolveLoginClientIp } from './login-client-ip'
import {
  activeBucketCount,
  getLoginWindow,
  LOGIN_WINDOW_MS,
  loginBucketKey,
} from './login-rate-limit-policy'

test('a janela termina no limite de 15 minutos e tentativas não a estendem', () => {
  const start = new Date('2026-10-21T12:00:00.000Z')
  const before = getLoginWindow(new Date(start.getTime() + LOGIN_WINDOW_MS - 1))
  const after = getLoginWindow(new Date(start.getTime() + LOGIN_WINDOW_MS))
  assert.equal(before.windowStartedAt.getTime(), start.getTime())
  assert.equal(before.expiresAt.getTime(), after.windowStartedAt.getTime())
  assert.equal(
    activeBucketCount(
      { count: 30, windowStartedAt: start },
      after.windowStartedAt,
    ),
    0,
  )
})

test('chaves separam IPs, CPFs e escopos sem armazenar valores brutos', () => {
  const first = loginBucketKey('cpf-ip', '11111111111', '192.0.2.1')
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, loginBucketKey('cpf-ip', '22222222222', '192.0.2.1'))
  assert.notEqual(first, loginBucketKey('cpf-ip', '11111111111', '192.0.2.2'))
  assert.notEqual(first, loginBucketKey('ip', '192.0.2.1'))
})

test('IPv6 equivalentes e IPv4-mapped não criam orçamentos diferentes', () => {
  assert.equal(
    normalizeClientIp('2001:0db8:0000:0000:0000:0000:0000:0001'),
    normalizeClientIp('2001:db8::1'),
  )
  assert.equal(
    normalizeClientIp('::ffff:192.0.2.1'),
    normalizeClientIp('192.0.2.1'),
  )
  assert.equal(normalizeClientIp('::ffff:c000:201'), '192.0.2.1')
})

test('desenvolvimento ignora headers de IP manipulados pelo cliente', () => {
  const headers = new Headers({
    'x-forwarded-for': '192.0.2.99',
    'x-vercel-forwarded-for': '192.0.2.98',
  })
  assert.equal(
    resolveLoginClientIp(headers, { NODE_ENV: 'development' }),
    '127.0.0.1',
  )
})

test('Vercel usa somente seu header e rejeita cadeias ou valores ausentes', () => {
  const env = { NODE_ENV: 'production', VERCEL: '1' }
  assert.equal(
    resolveLoginClientIp(
      new Headers({
        'x-vercel-forwarded-for': '192.0.2.1',
        'x-forwarded-for': '192.0.2.99',
      }),
      env,
    ),
    '192.0.2.1',
  )
  assert.throws(() => resolveLoginClientIp(new Headers(), env))
  assert.throws(() =>
    resolveLoginClientIp(
      new Headers({ 'x-vercel-forwarded-for': '192.0.2.1, 192.0.2.2' }),
      env,
    ),
  )
})

test('produção fora da Vercel exige proxy explicitamente confiável', () => {
  const headers = new Headers({ 'x-real-ip': '192.0.2.1' })
  assert.throws(() => resolveLoginClientIp(headers, { NODE_ENV: 'production' }))
  assert.equal(
    resolveLoginClientIp(headers, {
      NODE_ENV: 'production',
      LOGIN_TRUSTED_IP_HEADER: 'x-real-ip',
    }),
    '192.0.2.1',
  )
})
