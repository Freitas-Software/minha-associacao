'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import {
  ORGANIZATION_REQUEST_DOCUMENT_TYPES,
  ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES,
} from '@/modules/organizations/organization-request-limits'
import { requestOrganizationAction } from '../../actions'

function validateDocument(file: File): string | null {
  if (file.size > ORGANIZATION_REQUEST_MAX_DOCUMENT_BYTES) {
    return 'A ata deve ter no máximo 3 MB.'
  }

  if (
    !ORGANIZATION_REQUEST_DOCUMENT_TYPES.includes(
      file.type as (typeof ORGANIZATION_REQUEST_DOCUMENT_TYPES)[number],
    )
  ) {
    return 'A ata deve ser um arquivo PDF, JPEG ou PNG.'
  }

  return null
}

export function RequestOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    requestOrganizationAction,
    initialOrganizationActionState,
  )
  const [fileError, setFileError] = useState<string | null>(null)

  return (
    <form
      action={formAction}
      aria-busy={pending}
      encType="multipart/form-data"
      className="space-y-6"
      onSubmit={event => {
        if (fileError) event.preventDefault()
      }}
    >
      <FieldSet>
        <FieldLegend>Dados da associação</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="organization-cnpj">CNPJ</FieldLabel>
            <Input
              id="organization-cnpj"
              name="cnpj"
              type="text"
              inputMode="numeric"
              maxLength={18}
              placeholder="00.000.000/0000-00"
              required
            />
            <FieldDescription>
              A razão social será obtida na consulta à BrasilAPI.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="organization-acronym">Sigla</FieldLabel>
            <Input
              id="organization-acronym"
              name="acronym"
              type="text"
              maxLength={32}
              required
              placeholder="Ex.: AMA"
            />
          </Field>

          <Field data-invalid={Boolean(fileError)}>
            <FieldLabel htmlFor="organization-document">
              Ata de eleição
            </FieldLabel>
            <Input
              id="organization-document"
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
              aria-invalid={Boolean(fileError)}
              aria-describedby={
                fileError ? 'organization-document-error' : undefined
              }
              onChange={event => {
                const file = event.currentTarget.files?.[0]
                setFileError(file ? validateDocument(file) : null)
              }}
            />
            <FieldDescription>
              PDF, JPEG ou PNG com até 3 MB. O administrador da plataforma
              analisará a ata antes de criar a organização.
            </FieldDescription>
            {fileError ? (
              <p
                id="organization-document-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {fileError}
              </p>
            ) : null}
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          disabled={pending || state.status === 'success' || Boolean(fileError)}
        >
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Enviando…
            </>
          ) : (
            'Enviar solicitação'
          )}
        </Button>

        {state.status !== 'idle' ? (
          <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {state.status === 'success' ? (
          <p className="text-sm">
            <Link
              href="/app/organizacoes/solicitacoes"
              className="underline underline-offset-4"
            >
              Acompanhar minhas solicitações
            </Link>
          </p>
        ) : null}
      </FieldSet>
    </form>
  )
}
