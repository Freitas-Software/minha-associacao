const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDate(date: Date): string {
  return dateFormatter.format(date)
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date)
}
