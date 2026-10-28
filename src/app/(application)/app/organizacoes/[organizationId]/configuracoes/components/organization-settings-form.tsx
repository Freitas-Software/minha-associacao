'use client'

import { useActionState, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { updateOrganizationAction } from '../../../actions'

export function OrganizationSettingsForm({
  organizationId,
  acronym,
}: {
  organizationId: string
  acronym: string
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationAction,
    initialOrganizationActionState,
  )
  const [value, setValue] = useState(acronym)

  return (
    <form action={formAction} aria-busy={pending} className="space-y-6">
      <input type="hidden" name="organizationId" value={organizationId} />

      <FieldSet>
        <FieldLegend>Identificação</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="organization-acronym">Sigla</FieldLabel>
            <Input
              id="organization-acronym"
              name="acronym"
              type="text"
              minLength={2}
              maxLength={32}
              required
              value={value}
              onChange={event => setValue(event.currentTarget.value)}
            />
            <FieldDescription>
              A sigla pode ser ajustada. A razão social e o CNPJ permanecem
              vinculados à consulta da Receita Federal.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Salvando…
            </>
          ) : (
            'Salvar alterações'
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
