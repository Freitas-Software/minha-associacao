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
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PERMISSION_CATALOG } from '@/modules/authorization/permissions'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { createRoleAction } from '../../../actions'

export function CreateRoleForm({ organizationId }: { organizationId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    createRoleAction,
    initialOrganizationActionState,
  )
  const [isDirector, setIsDirector] = useState(false)
  const [hasFullAccess, setHasFullAccess] = useState(false)
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (hasFullAccess || isDirector) setIsDefault(false)
  }, [hasFullAccess, isDirector])

  useEffect(() => {
    if (state.status !== 'success') return

    formRef.current?.reset()
    setIsDirector(false)
    setHasFullAccess(false)
    setIsDefault(false)
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
      <input type="hidden" name="organizationId" value={organizationId} />

      <FieldSet>
        <FieldLegend>Novo cargo</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="role-name">Nome do cargo</FieldLabel>
            <Input
              id="role-name"
              name="name"
              type="text"
              maxLength={100}
              required
              placeholder="Ex.: Presidente, Tesoureiro, Associado"
            />
          </Field>

          <FieldGroup>
            <label
              htmlFor="role-director"
              className="flex cursor-pointer items-start gap-3 text-sm"
            >
              <input
                id="role-director"
                type="checkbox"
                name="isDirector"
                checked={isDirector}
                onChange={event => setIsDirector(event.currentTarget.checked)}
                className="mt-1 size-4 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span>
                Cargo de diretoria
                <span className="block text-xs text-muted-foreground">
                  A classificação de diretoria não concede permissões por si só.
                </span>
              </span>
            </label>

            <label
              htmlFor="role-full-access"
              className="flex cursor-pointer items-start gap-3 text-sm"
            >
              <input
                id="role-full-access"
                type="checkbox"
                name="hasFullAccess"
                checked={hasFullAccess}
                onChange={event =>
                  setHasFullAccess(event.currentTarget.checked)
                }
                className="mt-1 size-4 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span>
                Acesso completo
                <span className="block text-xs text-muted-foreground">
                  Inclui todas as permissões configuráveis atuais e futuras.
                </span>
              </span>
            </label>

            <label
              htmlFor="role-default"
              className="flex cursor-pointer items-start gap-3 text-sm"
            >
              <input
                id="role-default"
                type="checkbox"
                name="isDefault"
                checked={isDefault}
                disabled={isDirector || hasFullAccess}
                onChange={event => setIsDefault(event.currentTarget.checked)}
                className="mt-1 size-4 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span>
                Cargo padrão de ingresso
                <span className="block text-xs text-muted-foreground">
                  Deve ser único entre os cargos ativos, sem diretoria e sem
                  acesso completo.
                </span>
              </span>
            </label>
          </FieldGroup>

          <FieldSet disabled={hasFullAccess}>
            <FieldLegend variant="label">Permissões</FieldLegend>
            <FieldDescription>
              {hasFullAccess
                ? 'Cargos com acesso completo já possuem todas as permissões.'
                : 'Marque as permissões concedidas a este cargo.'}
            </FieldDescription>

            <div className="grid gap-3 sm:grid-cols-2">
              {PERMISSION_CATALOG.map(permission => (
                <label
                  key={permission.code}
                  htmlFor={`permission-${permission.code}`}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-muted/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 motion-reduce:transition-none"
                >
                  <input
                    id={`permission-${permission.code}`}
                    type="checkbox"
                    name="permissionCodes"
                    value={permission.code}
                    className="mt-0.5 size-4 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <span>{permission.description}</span>
                </label>
              ))}
            </div>
          </FieldSet>
        </FieldGroup>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Criando…
            </>
          ) : (
            'Criar cargo'
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
