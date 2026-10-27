import { timingSafeEqual } from 'node:crypto'
import { runCleanup } from '@/modules/maintenance/cleanup.server'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET

  if (!secret) return false

  const received = request.headers.get('authorization')

  if (!received) return false

  const expected = `Bearer ${secret}`
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const deleted = await runCleanup()
    return Response.json({ status: 'ok', deleted })
  } catch {
    console.error('[cleanup]', { stage: 'run' })
    return new Response('Cleanup failed', { status: 500 })
  }
}
