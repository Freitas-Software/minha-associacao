'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { FormMessage } from '@/components/ui/form-message'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { changeDefaultRoleAction } from '../../../actions'

export function ChangeDefaultRoleForm({
  organizationId,
  roleId,
  roleName,
}: {
  organizationId: string
  roleId: string
  roleName: string
}) {
  const [state, formAction, pending] = useActionState(
    changeDefaultRoleAction,
    initialOrganizationActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="mt-3 space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="roleId" value={roleId} />

      <ConfirmSubmitButton
        label="Definir como padrão"
        confirmLabel="Confirmar troca"
        description={`${roleName} passa a ser o cargo de ingresso padrão. O cargo padrão atual deixa de ser padrão, mas continua ativo.`}
        pending={pending}
        pendingLabel="Definindo…"
        variant="outline"
        size="sm"
      />

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}
