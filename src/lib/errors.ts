export function isDatabaseError(
  error: unknown,
): error is object & { constraint: string } {
  const databaseError =
    error instanceof Error && error.cause ? error.cause : error

  if (
    typeof databaseError === 'object' &&
    databaseError !== null &&
    'code' in databaseError &&
    databaseError.code === '23505' &&
    'constraint' in databaseError
  )
    return true

  return false
}
