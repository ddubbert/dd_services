import { Authenticator } from '../models/Authenticator'
import { UserAuth } from '../types/auth/UserAuth'
import { AuthMethod } from '../types/auth/AuthMethod'
import { AuthenticationError } from 'apollo-server'
import { AccessTokenContent } from '../types/auth/AccessTokenContent'

type ResolveUserFn = (req: Request) => Promise<AccessTokenContent|never>
type Request = {
  headers: { authorization: string }
  body: {
    query: string
  }
}

export const createAuthMiddleware = (auth: Authenticator): ResolveUserFn => {

  const getDDServiceAuthInfoFor = async (token: string): Promise<UserAuth> => ({
    ...(await auth.getVerifiedAccessTokenContent(token)),
    authMethod: AuthMethod.DD_SERVICES,
  })

  const resolveUserFn = async (req: Request): Promise<UserAuth|never> => {
    const token = req.headers.authorization
    if (!token) {return validateUser(null, req)}

    try {
      return validateUser(await getDDServiceAuthInfoFor(token), req)
    } catch (_e) {
      try {
        return validateUser(await auth.getKeycloakInfoFor(token), req)
      } catch (er) {
        return validateUser(null, req)
      }
    }
  }

  const validateUser = async (user: UserAuth|null, req: Request): Promise<UserAuth|never> => {
    const operation = req.body.query

    if (!user
      && !operation.includes('IntrospectionQuery')
      && !operation.includes('ApolloGetServiceDefinition')
      && !operation.includes('createOrLoginUser')
      && !operation.includes('refreshAuth')
    ) {throw new AuthenticationError('Access token not valid or outdated.') }

    return user || { userId: 'none', nickname: 'none', isPermanent: false, authMethod: AuthMethod.NONE }
  }

  return resolveUserFn
}

export default createAuthMiddleware
