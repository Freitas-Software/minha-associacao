export type InviteActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  inviteUrl?: string
}

export const initialInviteActionState: InviteActionState = {
  status: 'idle',
  message: '',
}
