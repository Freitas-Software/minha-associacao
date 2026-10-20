import 'server-only'
import z from 'zod'

const emailResponseSchema = z.object({
  id: z.string().min(1),
})

interface SendEmailInput {
  to: string
  subject: string
  text: string
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<z.output<typeof emailResponseSchema>> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from)
    throw new Error('Configure RESEND_API_KEY e EMAIL_FROM no servidor.')

  let response: Response

  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch {
    throw new Error(
      'Não foi possível confirmar o envio: falha na conexão ou tempo limite.',
    )
  }

  if (!response.ok)
    throw new Error(
      `O serviço de email recusou a solicitação. HTTP ${response.status}.`,
    )

  const body: unknown = await response.json().catch(() => null)
  const parsed = await emailResponseSchema.safeParseAsync(body)

  if (!parsed.success)
    throw new Error('O serviço de email retornou uma resposta inesperada.')

  return parsed.data
}
