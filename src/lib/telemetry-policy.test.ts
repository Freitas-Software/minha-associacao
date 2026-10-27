import assert from 'node:assert/strict'
import test from 'node:test'
import { publicTelemetryEvent } from './telemetry-policy'

test('métricas ignoram todas as rotas do app, inclusive tokens de recuperação e cadastro', () => {
  for (const path of [
    '/app',
    '/app/entrar',
    '/app/redefinir-senha?token=segredo',
    '/app/confirmar-cadastro?token=segredo',
  ])
    assert.equal(
      publicTelemetryEvent({
        url: `https://example.test${path}`,
        type: 'pageview',
      }),
      null,
    )
})

test('métricas públicas removem parâmetros e fragmentos e preservam demais campos', () => {
  assert.deepEqual(
    publicTelemetryEvent({
      url: 'https://example.test/precos?token=segredo#segredo',
      type: 'vital',
    }),
    { url: 'https://example.test/precos', type: 'vital' },
  )
  assert.equal(publicTelemetryEvent({ url: 'inválido' }), null)
})
