export function publicTelemetryEvent<T extends { url: string }>(
  event: T,
): T | null {
  try {
    const url = new URL(event.url)
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) return null
    // Parâmetros e fragmentos nunca são necessários para métricas públicas.
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}
