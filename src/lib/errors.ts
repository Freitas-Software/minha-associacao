function getDatabaseError(error: unknown): object | null {
  const databaseError =
    error instanceof Error && error.cause ? error.cause : error

  if (
    typeof databaseError === 'object' &&
    databaseError !== null &&
    'code' in databaseError &&
    databaseError.code === '23505'
  ) {
    return databaseError
  }

  return null
}

export function getDatabaseErrorConstraint(error: unknown): string | null {
  const databaseError = getDatabaseError(error)

  if (databaseError && 'constraint' in databaseError) {
    const { constraint } = databaseError

    if (typeof constraint === 'string') return constraint
  }

  return null
}

export function isDatabaseError(error: unknown): boolean {
  return getDatabaseError(error) !== null
}
