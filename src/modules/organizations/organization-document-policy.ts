export const ORGANIZATION_DOCUMENT_MAX_BYTES = 3 * 1024 * 1024

export const ORGANIZATION_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

export const ORGANIZATION_DOCUMENT_TYPES = [
  'statute',
  'election_minutes',
] as const

export type OrganizationDocumentType =
  (typeof ORGANIZATION_DOCUMENT_TYPES)[number]

export const ORGANIZATION_DOCUMENT_LABELS: Record<
  OrganizationDocumentType,
  string
> = {
  statute: 'Estatuto',
  election_minutes: 'Ata de eleição',
}
