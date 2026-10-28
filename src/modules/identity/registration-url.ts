export function registrationConfirmationUrl(): URL {
  const appUrl = process.env.APP_URL

  if (!appUrl) throw new Error('APP_URL não configurada.')

  const confirmationUrl = new URL('/app/confirmar-cadastro', appUrl)

  const isLocalDevelopment =
    process.env.NODE_ENV !== 'production' &&
    confirmationUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(confirmationUrl.hostname)

  if (confirmationUrl.protocol !== 'https:' && !isLocalDevelopment) {
    throw new Error('APP_URL deve utilizar HTTPS.')
  }

  return confirmationUrl
}
