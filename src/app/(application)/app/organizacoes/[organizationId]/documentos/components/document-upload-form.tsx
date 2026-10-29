'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import {
  ORGANIZATION_DOCUMENT_MAX_BYTES,
  ORGANIZATION_DOCUMENT_MIME_TYPES,
} from '@/modules/organizations/organization-document-policy'
import { uploadOrganizationDocumentAction } from '../actions'

type DocumentUploadFormProps = {
  organizationId: string
  type: 'statute' | 'election_minutes'
  label: string
  hasDocument: boolean
}

function validateFile(file: File): string | null {
  if (file.size > ORGANIZATION_DOCUMENT_MAX_BYTES) {
    return 'O arquivo deve ter no máximo 3 MB.'
  }

  if (
    !ORGANIZATION_DOCUMENT_MIME_TYPES.includes(
      file.type as (typeof ORGANIZATION_DOCUMENT_MIME_TYPES)[number],
    )
  ) {
    return 'Envie um arquivo PDF, JPEG ou PNG.'
  }

  return null
}

export function DocumentUploadForm({
  organizationId,
  type,
  label,
  hasDocument,
}: DocumentUploadFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    uploadOrganizationDocumentAction,
    initialOrganizationActionState,
  )
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (state.status !== 'success') return

    formRef.current?.reset()
    setFileError(null)
  }, [state.status])

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending}
      className="space-y-4"
      onSubmit={event => {
        event.preventDefault()

        const file = new FormData(event.currentTarget).get('document')

        if (file instanceof File && file.size > 0) {
          const error = validateFile(file)

          setFileError(error)

          if (error) return
        }

        formAction(new FormData(event.currentTarget))
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="type" value={type} />

      <FieldGroup>
        <Field data-invalid={Boolean(fileError)}>
          <FieldLabel htmlFor={`document-${type}`}>{label}</FieldLabel>
          <Input
            id={`document-${type}`}
            name="document"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            required
            aria-invalid={Boolean(fileError)}
            aria-describedby={`document-${type}-description${
              fileError ? ` document-${type}-error` : ''
            }`}
          />
          <FieldDescription id={`document-${type}-description`}>
            PDF, JPEG ou PNG, até 3 MB. O envio de um novo arquivo mantém o
            anterior no histórico.
          </FieldDescription>
          {fileError ? (
            <p
              id={`document-${type}-error`}
              className="text-sm text-destructive"
            >
              {fileError}
            </p>
          ) : null}
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} variant="outline">
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Enviando…
          </>
        ) : hasDocument ? (
          'Substituir documento'
        ) : (
          'Enviar documento'
        )}
      </Button>

      <FormMessage
        status={pending ? 'idle' : state.status}
        message={pending ? '' : state.message}
        className="mt-2"
      />
    </form>
  )
}
