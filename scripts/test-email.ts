import 'dotenv/config'
import z from 'zod'
import { sendEmail } from '../src/lib/email'

async function main(): Promise<void> {
  const recipient = z.email().safeParse(process.argv[2])

  if (!recipient.success) {
    throw new Error('Informe um email válido como argumento do comando.')
  }

  const result = await sendEmail({
    to: recipient.data,
    subject: 'Teste de envio — Associae',
    text: [
      'Este é um teste de envio da Associae.',
      '',
      'Nenhuma conta foi criada ou alterada.',
    ].join('\n'),
  })

  console.log('Solicitação aceita pelo Resend.')
  console.log(`Identificador do email: ${result.id}`)
  console.log('Confira o recebimento na caixa de entrada ou spam.')
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Não foi possível executar o teste.',
  )

  process.exitCode = 1
})
