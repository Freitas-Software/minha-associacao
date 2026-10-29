'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
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
import { formatCnpj, formatCpf } from '@/lib/formatters'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { createOrganizationAction } from '../actions'

export function CreateOrganizationForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    initialOrganizationActionState,
  )
  const [cnpj, setCnpj] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')

  useEffect(() => {
    if (state.status !== 'success') return

    formRef.current?.reset()
    setCnpj('')
    setDocumentNumber('')
  }, [state.status])

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending}
      className="space-y-6"
      onSubmit={event => {
        event.preventDefault()
        formAction(new FormData(event.currentTarget))
      }}
    >
      <FieldSet>
        <FieldLegend>Criar organização</FieldLegend>
        <p className="text-sm text-muted-foreground">
          Todos os campos são obrigatórios.
        </p>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="admin-organization-cnpj">CNPJ</FieldLabel>
            <FormattedInput
              id="admin-organization-cnpj"
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
              aria-describedby="admin-organization-cnpj-description"
            />
            <FieldDescription id="admin-organization-cnpj-description">
              A razão social é obtida na BrasilAPI. O CNAE deve pertencer ao
              grupo 94 (associações).
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="admin-organization-acronym">Sigla</FieldLabel>
            <Input
              id="admin-organization-acronym"
              name="acronym"
              type="text"
              maxLength={32}
              required
              placeholder="Ex.: AMA"
              autoComplete="off"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="admin-organization-grantee">
              CPF da pessoa que concluirá a configuração
            </FieldLabel>
            <FormattedInput
              id="admin-organization-grantee"
              name="granteeDocumentNumber"
              format={formatCpf}
              maxDigits={11}
              maxLength={14}
              autoComplete="off"
              placeholder="000.000.000-00"
              spellCheck={false}
              required
              value={documentNumber}
              onValueChange={setDocumentNumber}
              aria-describedby="admin-organization-grantee-description"
            />
            <FieldDescription id="admin-organization-grantee-description">
              Recebe uma concessão temporária, sem vínculo e sem cargo, que
              termina automaticamente na ativação. A pessoa precisa ter cadastro
              prévio.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Criando…
            </>
          ) : (
            'Criar organização'
          )}
        </Button>

        <FormMessage
          status={pending ? 'idle' : state.status}
          message={pending ? '' : state.message}
          className="mt-4"
        />
      </FieldSet>
    </form>
  )
}
