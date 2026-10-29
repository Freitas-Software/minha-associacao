import 'server-only'
import { del, get, put } from '@vercel/blob'

function getToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN

  if (!token) {
    throw new Error(
      'O armazenamento de documentos não está configurado: defina BLOB_READ_WRITE_TOKEN.',
    )
  }

  return token
}

export function isDocumentStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export async function storeDocumentFile(
  pathname: string,
  file: { data: Buffer; contentType: string },
): Promise<{ storageKey: string }> {
  const blob = await put(pathname, file.data, {
    access: 'private',
    contentType: file.contentType,
    addRandomSuffix: false,
    token: getToken(),
  })

  return { storageKey: blob.pathname }
}

export async function removeDocumentFile(storageKey: string): Promise<void> {
  await del(storageKey, { token: getToken() })
}

export async function openDocumentFile(storageKey: string) {
  return get(storageKey, { access: 'private', token: getToken() })
}
