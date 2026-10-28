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
import { formatCpf, formatPhone } from '@/lib/formatters'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { requestPreRegistrationAction } from '../../../../actions'

export type PreRegistrationRole = {
  id: string
  name: string
  isDefault: boolean
  hasFullAccess: boolean
}

export function PreRegistrationForm({
  organizationId,
  roles,
}: {
  organizationId: string
  roles: PreRegistrationRole[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    requestPreRegistrationAction,
    initialOrganizationActionState,
  )
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const defaultRole = roles.find(role => role.isDefault) ?? roles[0]

  useEffect(() => {
    if (state.status !== 'success') return

    formRef.current?.reset()
    setCpf('')
    setPhone('')
  }, [state.status])

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending}
      className="space-y-6"
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      <FieldSet>
        <FieldLegend>Dados da pessoa</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pre-registration-cpf">CPF</FieldLabel>
            <FormattedInput
              id="pre-registration-cpf"
              name="documentNumber"
              format={formatCpf}
              maxDigits={11}
              maxLength={14}
              autoComplete="off"
              placeholder="000.000.000-00"
              required
              value={cpf}
              onValueChange={setCpf}
            />
            <FieldDescription>
              O perfil é global: se o CPF já existir, os dados cadastrados serão
              reaproveitados.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="pre-registration-name">
              Nome completo
            </FieldLabel>
            <Input
              id="pre-registration-name"
              name="name"
              type="text"
              maxLength={255}
              autoComplete="off"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="pre-registration-email">Email</FieldLabel>
            <Input
              id="pre-registration-email"
              name="email"
              type="email"
              maxLength={55}
              autoComplete="off"
              required
            />
            <FieldDescription>
              Se a pessoa já tiver um email cadastrado, o link será enviado ao
              endereço existente.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="pre-registration-phone">Telefone</FieldLabel>
            <FormattedInput
              id="pre-registration-phone"
              name="phone"
              format={formatPhone}
              maxDigits={11}
              maxLength={15}
              autoComplete="off"
              placeholder="(00) 00000-0000"
              required
              value={phone}
              onValueChange={setPhone}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="pre-registration-birth-date">
              Data de nascimento
            </FieldLabel>
            <Input
              id="pre-registration-birth-date"
              name="birthDate"
              type="date"
              autoComplete="off"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="pre-registration-role">
              Cargo inicial
            </FieldLabel>
            <select
              id="pre-registration-role"
              name="roleId"
              defaultValue={defaultRole?.id}
              required
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.isDefault ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
            <FieldDescription>
              O vínculo será criado com este cargo quando a pessoa concluir a
              conta.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending || roles.length === 0}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Enviando…
            </>
          ) : (
            'Enviar link de ativação'
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
