import 'server-only'
import z from 'zod'
import { normalizeCnpj } from './cnpj'

const responseSchema = z.object({
  cnpj: z.string().min(14),
  razao_social: z.string().min(1).max(255),
})

export type CnpjLookup = {
  cnpj: string
  legalName: string
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookup> {
  const normalized = normalizeCnpj(cnpj)

  let response: Response

  try {
    response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${normalized}`,
      {
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      },
    )
  } catch {
    throw new Error('Não foi possível consultar o CNPJ agora.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const apiMessage =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : null

    console.error('[lookupCnpj]', {
      status: response.status,
      apiMessage,
    })

    if (response.status === 404) {
      throw new Error(
        'A BrasilAPI não encontrou este CNPJ na base da Receita Federal. Confira se o número está correto e se a empresa está ativa.',
      )
    }

    if (response.status === 429) {
      throw new Error(
        'A BrasilAPI atingiu o limite de consultas. Aguarde alguns minutos e tente novamente.',
      )
    }

    if (response.status >= 500) {
      throw new Error(
        'A BrasilAPI está indisponível agora. Tente novamente em instantes.',
      )
    }

    throw new Error(
      `A BrasilAPI recusou a consulta (HTTP ${response.status})${apiMessage ? `: ${apiMessage}` : ''}.`,
    )
  }

  const parsed = responseSchema.safeParse(
    await response.json().catch(() => null),
  )

  if (!parsed.success) {
    throw new Error('A BrasilAPI retornou dados inesperados para o CNPJ.')
  }

  const returnedCnpj = normalizeCnpj(parsed.data.cnpj)

  if (returnedCnpj !== normalized) {
    throw new Error(
      'A BrasilAPI retornou um CNPJ diferente do número consultado.',
    )
  }

  return {
    cnpj: returnedCnpj,
    legalName: parsed.data.razao_social,
  }
}
