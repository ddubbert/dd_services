export type UserRole = 'owners' | 'participants'

export const getOtherRole = (role: UserRole) => role === 'owners' ? 'participants' : 'owners'
