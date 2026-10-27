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
    throw new Error('O CNPJ não foi encontrado na BrasilAPI.')
  }

  const parsed = responseSchema.safeParse(
    await response.json().catch(() => null),
  )

  if (!parsed.success) {
    throw new Error('A BrasilAPI retornou dados inesperados para o CNPJ.')
  }

  return {
    cnpj: normalizeCnpj(parsed.data.cnpj),
    legalName: parsed.data.razao_social,
  }
}
