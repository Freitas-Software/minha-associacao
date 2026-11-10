'use client'

import { SendIcon } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import { FormattedInput } from '@/components/ui/formatted-input'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { formatCnpj } from '@/lib/formatters'
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
  const [cnpj, setCnpj] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const documentDescription = fileError
    ? 'organization-document-description organization-document-error'
    : 'organization-document-description'

  return (
    <form
      action={formAction}
      aria-busy={pending}
      encType="multipart/form-data"
      className="space-y-8 rounded-lg border bg-background p-5 sm:p-6"
      onSubmit={event => {
        event.preventDefault()

        if (fileError) {
          documentInputRef.current?.focus()

          return
        }

        formAction(new FormData(event.currentTarget))
      }}
    >
      <p className="text-sm text-muted-foreground">
        Todos os campos são obrigatórios.
      </p>

      <FieldSet>
        <FieldLegend>1. Identificação da associação</FieldLegend>

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="organization-cnpj">CNPJ</FieldLabel>
              <FormattedInput
                id="organization-cnpj"
                name="cnpj"
                format={formatCnpj}
                maxDigits={14}
                maxLength={18}
                autoComplete="off"
                placeholder="00.000.000/0000-00"
                spellCheck={false}
                required
                value={cnpj}
                onValueChange={setCnpj}
                aria-describedby="organization-cnpj-description"
              />
              <FieldDescription id="organization-cnpj-description">
                A consulta à BrasilAPI acontece quando você envia a solicitação.
                O CNPJ precisa estar ativo e ter CNAE do grupo 94 (atividades de
                associação).
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
                autoComplete="off"
                aria-describedby="organization-acronym-description"
              />
              <FieldDescription id="organization-acronym-description">
                Até 32 caracteres. A sigla pode ser ajustada depois, nas
                configurações da organização.
              </FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <div className="border-t pt-8">
        <FieldSet>
          <FieldLegend>2. Ata de eleição e posse</FieldLegend>

          <p className="text-sm text-muted-foreground">
            Anexe a ata que comprova a sua condição de presidente. A
            administração da plataforma vai analisar o documento antes de
            aprovar a criação da organização.
          </p>

          <Field data-invalid={Boolean(fileError)}>
            <FieldLabel htmlFor="organization-document">
              Ata de eleição
            </FieldLabel>
            <Input
              ref={documentInputRef}
              id="organization-document"
              name="document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
              aria-invalid={Boolean(fileError)}
              aria-describedby={documentDescription}
              onChange={event => {
                const file = event.currentTarget.files?.[0]
                setFileError(file ? validateDocument(file) : null)
              }}
            />
            <FieldDescription id="organization-document-description">
              PDF, JPEG ou PNG, até 3 MB.
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
        </FieldSet>
      </div>

      <div className="border-t pt-8">
        <FieldSet>
          <FieldLegend>3. Declaração de presidência</FieldLegend>

          <Field>
            <label
              htmlFor="organization-president-declaration"
              className="flex items-start gap-2 text-sm"
            >
              <input
                id="organization-president-declaration"
                name="presidentDeclaration"
                type="checkbox"
                required
                className="mt-0.5 size-4 shrink-0 accent-primary"
                aria-describedby="organization-president-declaration-description"
              />
              <span>
                Declaro que sou o presidente desta associação e que a ata de
                eleição anexada comprova essa condição.
              </span>
            </label>
            <FieldDescription id="organization-president-declaration-description">
              A declaração é obrigatória e será considerada na análise da
              solicitação.
            </FieldDescription>
          </Field>
        </FieldSet>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            nativeButton={false}
            render={<Link href="/app/organizacoes" />}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={pending || state.status === 'success'}
            className="w-full whitespace-normal sm:w-auto"
          >
            {pending ? (
              <>
                <Spinner data-icon="inline-start" />
                Enviando…
              </>
            ) : (
              <>
                Enviar solicitação para análise
                <SendIcon aria-hidden="true" data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>

        <FormMessage
          status={pending ? 'idle' : state.status}
          message={pending ? '' : state.message}
        />

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
      </div>
    </form>
  )
}
