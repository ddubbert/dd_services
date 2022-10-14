import { AuthMethod } from './authMethod'
import { AccessTokenContent } from './accessTokenContent'

export type UserAuth = AccessTokenContent & { authMethod: AuthMethod }
