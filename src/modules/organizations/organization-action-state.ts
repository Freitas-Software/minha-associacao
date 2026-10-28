export type OrganizationActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export const initialOrganizationActionState: OrganizationActionState = {
  status: 'idle',
  message: '',
}
