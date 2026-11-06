import assert from 'node:assert/strict'
import { afterEach, test, vi } from 'vitest'
import { lookupCnpj } from './cnpj.server'

const CNPJ = '56.443.573/0001-44'
const NORMALIZED = '56443573000144'

afterEach(() => {
  vi.restoreAllMocks()
})

test('lookupCnpj sends a descriptive User-Agent', async () => {
  let captured: RequestInit | undefined

  vi.spyOn(globalThis, 'fetch').mockImplementation(
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

  const result = await lookupCnpj(CNPJ)

  assert.deepEqual(result, {
    cnpj: NORMALIZED,
    legalName: 'ASSOCIACAO TESTE',
    cnaeFiscal: '9430800',
  })

  const headers = captured?.headers as Record<string, string>

  assert.equal(headers['User-Agent'], 'Associae/1.0')
  assert.equal(headers.Accept, 'application/json')
})

test('lookupCnpj maps rate limiting and provider errors', async () => {
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('', { status: item.status }),
    )

    await assert.rejects(() => lookupCnpj(CNPJ), item.expected)
  }
})

test('lookupCnpj rejects a CNPJ outside the association CNAE group', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
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

  await assert.rejects(() => lookupCnpj(CNPJ), /grupo 94/)
})
