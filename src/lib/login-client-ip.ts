import 'server-only'
import { isIP } from 'node:net'

interface HeaderReader {
  get(name: string): string | null
}

interface IpEnvironment {
  NODE_ENV?: string
  VERCEL?: string
  LOGIN_TRUSTED_IP_HEADER?: string
}

export function normalizeClientIp(value: string): string {
  const ip = value.trim()
  const version = isIP(ip)
  if (version === 4) return ip
  if (version !== 6) throw new Error('LOGIN_CLIENT_IP_INVALID')

  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
  // Representações IPv4 e IPv4-mapped IPv6 compartilham o mesmo contador.
  if (canonical.startsWith('::ffff:')) {
    const parts = canonical.slice(7).split(':')
    if (parts.length === 2) {
      const high = Number.parseInt(parts[0], 16)
      const low = Number.parseInt(parts[1], 16)
      return [high >> 8, high & 255, low >> 8, low & 255].join('.')
    }
  }
  return canonical
}

export function resolveLoginClientIp(
  requestHeaders: HeaderReader,
  environment: IpEnvironment = process.env,
): string {
  let header: string
  if (environment.VERCEL === '1') {
    header = 'x-vercel-forwarded-for'
  } else if (environment.NODE_ENV !== 'production') {
    // Server Actions não expõem o socket. Em dev, todos compartilham
    // este contador; headers arbitrários não podem contornar o limite.
    return '127.0.0.1'
  } else {
    header = environment.LOGIN_TRUSTED_IP_HEADER ?? ''
    if (!/^[a-z0-9-]+$/.test(header)) {
      throw new Error('LOGIN_TRUSTED_IP_HEADER_REQUIRED')
    }
  }

  const value = requestHeaders.get(header)
  if (!value) throw new Error('LOGIN_CLIENT_IP_MISSING')
  // Exige um IP único, sobrescrito pelo proxy confiável, e não uma cadeia
  // fornecida pelo cliente. Falha fechada se a configuração for inválida.
  return normalizeClientIp(value)
}
