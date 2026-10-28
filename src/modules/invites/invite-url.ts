import 'server-only'

export function inviteAcceptanceUrl(
  token: string,
  env: { APP_URL?: string; NODE_ENV?: string } = process.env,
): string {
  const base = new URL(env.APP_URL ?? '')
  const local =
    env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)

  if (
    base.username ||
    base.password ||
    (base.protocol !== 'https:' && !(local && base.protocol === 'http:'))
  ) {
    throw new Error('APP_URL deve usar HTTPS em produção.')
  }

  const url = new URL('/app/convites/aceitar', base.origin)
  url.searchParams.set('token', token)

  return url.toString()
}
