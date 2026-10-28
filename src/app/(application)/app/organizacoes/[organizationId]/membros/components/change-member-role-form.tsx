'use client'

import { useActionState } from 'react'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Field, FieldLabel } from '@/components/ui/field'
import { FormMessage } from '@/components/ui/form-message'
import type { AssignableRole } from '@/modules/organizations/organization.server'
import { initialOrganizationActionState } from '@/modules/organizations/organization-action-state'
import { updateMembershipRoleAction } from '../../../actions'

export function ChangeMemberRoleForm({
  organizationId,
  membershipId,
  memberName,
  currentRoleId,
  roles,
}: {
  organizationId: string
  membershipId: string
  memberName: string
  currentRoleId: string
  roles: AssignableRole[]
}) {
  const [state, formAction, pending] = useActionState(
    updateMembershipRoleAction,
    initialOrganizationActionState,
  )

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="membershipId" value={membershipId} />

      <Field>
        <FieldLabel htmlFor={`role-${membershipId}`}>Alterar cargo</FieldLabel>
        <select
          id={`role-${membershipId}`}
          name="roleId"
          defaultValue={currentRoleId}
          required
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </Field>

      <ConfirmSubmitButton
        label="Alterar cargo"
        confirmLabel="Confirmar alteração"
        description={`${memberName} passará a ter as permissões do cargo selecionado.`}
        pending={pending}
        pendingLabel="Alterando…"
        size="sm"
      />

      <FormMessage status={state.status} message={state.message} />
    </form>
  )
}
