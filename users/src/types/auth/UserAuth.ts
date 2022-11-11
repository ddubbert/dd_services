import { AuthMethod } from './AuthMethod'
import { AccessTokenContent } from './AccessTokenContent'

export type UserAuth = AccessTokenContent & {
  authMethod: AuthMethod
  email?: string
}
