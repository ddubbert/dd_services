export type UserRole = 'owners' | 'participants'

export const getOtherRole = (role: UserRole): string => role === 'owners' ? 'participants' : 'owners'
