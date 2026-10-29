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
import { formatCpf } from '@/lib/formatters'
import { initialInviteActionState } from '@/modules/invites/invite-action-state'
import { createInviteAction } from '../../../actions'

type RoleOption = {
  id: string
  name: string
  isDirector: boolean
  hasFullAccess: boolean
  isDefault: boolean
}

type CopyState = 'idle' | 'copied' | 'failed'

const selectClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30'

export function CreateInviteForm({
  organizationId,
  roles,
}: {
  organizationId: string
  roles: RoleOption[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    createInviteAction,
    initialInviteActionState,
  )
  const [type, setType] = useState<'individual' | 'shared'>('individual')
  const [documentNumber, setDocumentNumber] = useState('')
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const eligibleRoles =
    type === 'shared'
      ? roles.filter(role => !role.isDirector && !role.hasFullAccess)
      : roles

  useEffect(() => {
    if (copyState === 'idle') return

    const timeout = window.setTimeout(() => setCopyState('idle'), 4000)

    return () => window.clearTimeout(timeout)
  }, [copyState])

  useEffect(() => {
    if (state.status !== 'success') return

    formRef.current?.reset()
    setType('individual')
    setDocumentNumber('')
    setCopyState('idle')
  }, [state.status])

  async function copyInviteUrl() {
    if (!state.inviteUrl) return

    try {
      await navigator.clipboard.writeText(state.inviteUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

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
              aria-describedby="invite-type-description"
              className={selectClassName}
            >
              <option value="individual">Individual, vinculado ao CPF</option>
              <option value="shared">Compartilhado</option>
            </select>
            <FieldDescription id="invite-type-description">
              O convite individual pode indicar qualquer cargo que você tenha
              autoridade para conceder. O compartilhado não pode conceder
              diretoria nem acesso completo.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="invite-role">Cargo</FieldLabel>
            <select
              key={type}
              id="invite-role"
              name="roleId"
              required={type === 'individual'}
              aria-describedby="invite-role-description"
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
            <FieldDescription id="invite-role-description">
              O cargo define as permissões que a pessoa terá ao aceitar o
              convite.
            </FieldDescription>
          </Field>

          {type === 'individual' ? (
            <Field>
              <FieldLabel htmlFor="invite-document">
                CPF do convidado
              </FieldLabel>
              <FormattedInput
                id="invite-document"
                name="documentNumber"
                format={formatCpf}
                maxDigits={11}
                maxLength={14}
                autoComplete="off"
                placeholder="000.000.000-00"
                spellCheck={false}
                required
                value={documentNumber}
                onValueChange={setDocumentNumber}
                aria-describedby="invite-document-description"
              />
              <FieldDescription id="invite-document-description">
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
                aria-describedby="invite-max-uses-description"
              />
              <FieldDescription id="invite-max-uses-description">
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

        <FormMessage
          status={pending ? 'idle' : state.status}
          message={pending ? '' : state.message}
          className="mt-4"
        />

        {state.inviteUrl ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Link do convite</p>
            <p className="text-sm break-all text-muted-foreground select-all">
              {state.inviteUrl}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={copyInviteUrl}>
                {copyState === 'copied' ? 'Link copiado' : 'Copiar link'}
              </Button>
              <p
                role={copyState === 'failed' ? 'alert' : 'status'}
                className={
                  copyState === 'failed'
                    ? 'text-sm text-destructive'
                    : 'text-sm text-muted-foreground'
                }
              >
                {copyState === 'copied'
                  ? 'Link copiado para a área de transferência.'
                  : copyState === 'failed'
                    ? 'Não foi possível copiar automaticamente. Selecione o link acima.'
                    : ''}
              </p>
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
