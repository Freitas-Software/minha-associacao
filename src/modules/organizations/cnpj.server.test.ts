import assert from 'node:assert/strict'
import test from 'node:test'
import { lookupCnpj } from './cnpj.server'

const CNPJ = '56.443.573/0001-44'
const NORMALIZED = '56443573000144'

test('lookupCnpj sends a descriptive User-Agent', async t => {
  let captured: RequestInit | undefined

  const mock = t.mock.method(
    globalThis,
    'fetch',
    async (
      _input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      captured = init

      return new Response(
        JSON.stringify({
          cnpj: NORMALIZED,
          razao_social: 'ASSOCIACAO TESTE',
          cnae_fiscal: 9430800,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  )

  try {
    const result = await lookupCnpj(CNPJ)

    assert.deepEqual(result, {
      cnpj: NORMALIZED,
      legalName: 'ASSOCIACAO TESTE',
      cnaeFiscal: '9430800',
    })

    const headers = captured?.headers as Record<string, string>

    assert.equal(headers['User-Agent'], 'Associae/1.0')
    assert.equal(headers.Accept, 'application/json')
  } finally {
    mock.mock.restore()
  }
})

test('lookupCnpj maps rate limiting and provider errors', async t => {
  const cases = [
    {
      status: 429,
      expected: /limite de consultas/,
    },
    {
      status: 404,
      expected: /não encontrou este CNPJ/,
    },
    {
      status: 403,
      expected: /HTTP 403/,
    },
    {
      status: 503,
      expected: /indisponível agora/,
    },
  ]

  for (const item of cases) {
    const mock = t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('', { status: item.status }),
    )

    try {
      await assert.rejects(() => lookupCnpj(CNPJ), item.expected)
    } finally {
      mock.mock.restore()
    }
  }
})

test('lookupCnpj rejects a CNPJ outside the association CNAE group', async t => {
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          cnpj: NORMALIZED,
          razao_social: 'EMPRESA TESTE',
          cnae_fiscal: 6201500,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  )

  try {
    await assert.rejects(() => lookupCnpj(CNPJ), /grupo 94/)
  } finally {
    mock.mock.restore()
  }
})
