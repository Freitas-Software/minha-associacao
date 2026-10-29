import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizationDocuments, users } from '@/db/schema'
import { recordAuditEvent } from '@/modules/audit/audit.server'
import {
  getOrganizationAccess,
  hasPermission,
} from '@/modules/authorization/authorize.server'
import { PERMISSIONS } from '@/modules/authorization/permissions'
import {
  ORGANIZATION_DOCUMENT_LABELS,
  ORGANIZATION_DOCUMENT_MAX_BYTES,
  ORGANIZATION_DOCUMENT_MIME_TYPES,
  ORGANIZATION_DOCUMENT_TYPES,
  type OrganizationDocumentType,
} from './organization-document-policy'
import {
  openDocumentFile,
  removeDocumentFile,
  storeDocumentFile,
} from './organization-document-storage.server'

type DocumentStorage = {
  store: typeof storeDocumentFile
  remove: typeof removeDocumentFile
}

const defaultStorage: DocumentStorage = {
  store: storeDocumentFile,
  remove: removeDocumentFile,
}

export type UploadOrganizationDocumentInput = {
  actorUserId: string
  organizationId: string
  type: string
  fileName: string
  contentType: string
  data: Buffer
}

export type UploadOrganizationDocumentResult =
  | { status: 'uploaded'; documentId: string }
  | { status: 'forbidden' }
  | { status: 'invalid-type' }
  | { status: 'invalid-file' }
  | { status: 'storage-failed' }

function normalizeFileName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-zA-Z0-9._-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)

  return normalized || 'documento'
}

export async function uploadOrganizationDocument(
  input: UploadOrganizationDocumentInput,
  database: typeof db = db,
  storage: DocumentStorage = defaultStorage,
): Promise<UploadOrganizationDocumentResult> {
  const access = await getOrganizationAccess(
    input.actorUserId,
    input.organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationUpdate)) {
    return { status: 'forbidden' }
  }

  if (
    !ORGANIZATION_DOCUMENT_TYPES.includes(
      input.type as OrganizationDocumentType,
    )
  ) {
    return { status: 'invalid-type' }
  }

  if (
    input.data.length === 0 ||
    input.data.length > ORGANIZATION_DOCUMENT_MAX_BYTES ||
    !ORGANIZATION_DOCUMENT_MIME_TYPES.includes(
      input.contentType as (typeof ORGANIZATION_DOCUMENT_MIME_TYPES)[number],
    )
  ) {
    return { status: 'invalid-file' }
  }

  const type = input.type as OrganizationDocumentType
  const pathname = `organizations/${input.organizationId}/documentos/${type}/${randomUUID()}-${normalizeFileName(input.fileName)}`

  let storageKey: string

  try {
    const stored = await storage.store(pathname, {
      data: input.data,
      contentType: input.contentType,
    })

    storageKey = stored.storageKey
  } catch {
    return { status: 'storage-failed' }
  }

  try {
    return await database.transaction(async tx => {
      const [document] = await tx
        .insert(organizationDocuments)
        .values({
          organizationId: input.organizationId,
          type,
          storageKey,
          uploadedByUserId: input.actorUserId,
        })
        .returning({ id: organizationDocuments.id })

      if (!document) {
        throw new Error('O documento não retornou um ID.')
      }

      await recordAuditEvent(tx, {
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        action: 'organization.document_uploaded',
        entityType: 'organization_document',
        entityId: document.id,
        metadata: { type },
      })

      return { status: 'uploaded' as const, documentId: document.id }
    })
  } catch (error) {
    await storage.remove(storageKey).catch(() => undefined)
    throw error
  }
}

export type OrganizationDocumentListItem = {
  id: string
  type: OrganizationDocumentType
  label: string
  storageKey: string
  uploadedByUserId: string
  uploadedByName: string
  createdAt: Date
}

export type ListOrganizationDocumentsResult =
  | { status: 'ok'; documents: OrganizationDocumentListItem[] }
  | { status: 'forbidden' }

export async function listOrganizationDocuments(
  actorUserId: string,
  organizationId: string,
  database: typeof db = db,
): Promise<ListOrganizationDocumentsResult> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationRead)) {
    return { status: 'forbidden' }
  }

  const rows = await database
    .select({
      id: organizationDocuments.id,
      type: organizationDocuments.type,
      storageKey: organizationDocuments.storageKey,
      uploadedByUserId: organizationDocuments.uploadedByUserId,
      uploadedByName: users.name,
      createdAt: organizationDocuments.createdAt,
    })
    .from(organizationDocuments)
    .innerJoin(users, eq(users.id, organizationDocuments.uploadedByUserId))
    .where(eq(organizationDocuments.organizationId, organizationId))
    .orderBy(desc(organizationDocuments.createdAt))

  return {
    status: 'ok',
    documents: rows.map(document => ({
      ...document,
      type: document.type as OrganizationDocumentType,
      label: ORGANIZATION_DOCUMENT_LABELS[document.type],
    })),
  }
}

export type OrganizationDocumentDownload =
  | {
      status: 'ok'
      fileName: string
      contentType: string
      data: ArrayBuffer
    }
  | { status: 'forbidden' }
  | { status: 'not-found' }

export async function getOrganizationDocumentDownload(
  actorUserId: string,
  organizationId: string,
  documentId: string,
  database: typeof db = db,
): Promise<OrganizationDocumentDownload> {
  const access = await getOrganizationAccess(
    actorUserId,
    organizationId,
    database,
  )

  if (!access || !hasPermission(access, PERMISSIONS.organizationRead)) {
    return { status: 'forbidden' }
  }

  const [document] = await database
    .select({
      storageKey: organizationDocuments.storageKey,
    })
    .from(organizationDocuments)
    .where(
      and(
        eq(organizationDocuments.id, documentId),
        eq(organizationDocuments.organizationId, organizationId),
      ),
    )
    .limit(1)

  if (!document) return { status: 'not-found' }

  try {
    const blob = await openDocumentFile(document.storageKey)

    if (!blob || blob.stream === null) return { status: 'not-found' }

    return {
      status: 'ok',
      fileName: document.storageKey.split('/').at(-1) ?? 'documento',
      contentType: blob.blob.contentType ?? 'application/octet-stream',
      data: await new Response(blob.stream).arrayBuffer(),
    }
  } catch {
    return { status: 'not-found' }
  }
}
