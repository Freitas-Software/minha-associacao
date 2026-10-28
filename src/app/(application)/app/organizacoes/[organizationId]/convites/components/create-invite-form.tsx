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
import { initialInviteActionState } from '@/modules/invites/invite-action-state'
import { createInviteAction } from '../../../actions'

type RoleOption = {
  id: string
  name: string
  isDirector: boolean
  hasFullAccess: boolean
  isDefault: boolean
}

const selectClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

export function CreateInviteForm({
  organizationId,
  roles,
}: {
  organizationId: string
  roles: RoleOption[]
}) {
  const [state, formAction, pending] = useActionState(
    createInviteAction,
    initialInviteActionState,
  )
  const [type, setType] = useState<'individual' | 'shared'>('individual')
  const [copied, setCopied] = useState(false)

  const eligibleRoles =
    type === 'shared'
      ? roles.filter(role => !role.isDirector && !role.hasFullAccess)
      : roles

  async function copyInviteUrl() {
    if (!state.inviteUrl) return

    try {
      await navigator.clipboard.writeText(state.inviteUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-6">
      <input type="hidden" name="organizationId" value={organizationId} />

      <FieldSet>
        <FieldLegend>Novo convite</FieldLegend>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invite-type">Tipo de convite</FieldLabel>
            <select
              id="invite-type"
              name="type"
              value={type}
              onChange={event =>
                setType(event.currentTarget.value as 'individual' | 'shared')
              }
              className={selectClassName}
            >
              <option value="individual">Individual, vinculado ao CPF</option>
              <option value="shared">Compartilhado</option>
            </select>
            <FieldDescription>
              O convite individual pode indicar qualquer cargo. O compartilhado
              não pode conceder diretoria nem acesso completo.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="invite-role">Cargo</FieldLabel>
            <select
              key={type}
              id="invite-role"
              name="roleId"
              required={type === 'individual'}
              className={selectClassName}
            >
              <option value="">
                {type === 'shared'
                  ? 'Cargo padrão de ingresso'
                  : 'Selecione um cargo'}
              </option>
              {eligibleRoles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.hasFullAccess ? ' (acesso completo)' : ''}
                  {role.isDirector ? ' (diretoria)' : ''}
                </option>
              ))}
            </select>
          </Field>

          {type === 'individual' ? (
            <Field>
              <FieldLabel htmlFor="invite-document">
                CPF do convidado
              </FieldLabel>
              <Input
                id="invite-document"
                name="documentNumber"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                placeholder="000.000.000-00"
                required
              />
              <FieldDescription>
                O convite só poderá ser aceito pela pessoa com este CPF.
              </FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="invite-max-uses">Limite de usos</FieldLabel>
              <Input
                id="invite-max-uses"
                name="maxUses"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Sem limite"
              />
              <FieldDescription>
                Deixe em branco para permitir usos ilimitados.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Criando…
            </>
          ) : (
            'Criar convite'
          )}
        </Button>

        {state.status !== 'idle' ? (
          <Alert variant={state.status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {state.inviteUrl ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Link do convite</p>
            <p className="break-all text-sm text-muted-foreground">
              {state.inviteUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyInviteUrl}>
                {copied ? 'Link copiado' : 'Copiar link'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O envio por email ainda não está configurado. Copie e envie o link
              manualmente.
            </p>
          </div>
        ) : null}
      </FieldSet>
    </form>
  )
}
