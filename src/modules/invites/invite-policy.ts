// Confirmed policy: individual 7 days/1 use; shared 30 days with operator-defined uses.
// Resending invalidates the previous link and is rate-limited to one per minute.
export const INVITE_INDIVIDUAL_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const INVITE_SHARED_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const INVITE_RESEND_INTERVAL_MS = 60 * 1000
export const INVITE_TOKEN_BYTES = 32
