'use client'

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
import { PERMISSION_CATALOG } from '@/modules/authorization/permissions'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { createRoleAction } from '../../../actions'

export function CreateRoleForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(
    createRoleAction,
    initialOrganizationActionState,
  )
  const [hasFullAccess, setHasFullAccess] = useState(false)

  return (
    <form action={formAction} aria-busy={pending} className="space-y-6">
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
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="isDirector"
                className="mt-1 size-4 rounded border-input accent-primary"
              />
              <span>
                Cargo de diretoria
                <span className="block text-xs text-muted-foreground">
                  A classificação de diretoria não concede permissões por si só.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="hasFullAccess"
                checked={hasFullAccess}
                onChange={event =>
                  setHasFullAccess(event.currentTarget.checked)
                }
                className="mt-1 size-4 rounded border-input accent-primary"
              />
              <span>
                Acesso completo
                <span className="block text-xs text-muted-foreground">
                  Inclui todas as permissões configuráveis atuais e futuras.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="isDefault"
                className="mt-1 size-4 rounded border-input accent-primary"
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

          <FieldSet>
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
                  className="flex items-start gap-2 rounded-md border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="permissionCodes"
                    value={permission.code}
                    disabled={hasFullAccess}
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <span>
                    {permission.description}
                    <span className="block text-xs text-muted-foreground">
                      {permission.code}
                    </span>
                  </span>
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

        {state.status !== 'idle' ? (
          <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
      </FieldSet>
    </form>
  )
}
