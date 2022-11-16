import { Authenticator } from '../models/Authenticator'
import { AuthenticationError } from 'apollo-server'
import { AccessTokenContent } from '../types/AccessTokenContent'
import { Maybe } from '@graphql-tools/utils'

type ResolveUserFn = (req: Request) => Promise<AccessTokenContent|never>
type Request = {
  headers: { authorization: string }
  body: {
    query: string
  }
}

export const createAuthMiddleware = (auth: Authenticator): ResolveUserFn => {
  const resolveUserFn: ResolveUserFn = async (req: Request): Promise<AccessTokenContent|never> => {
    const token = req.headers.authorization
    if (!token) {
      return validateUser(null, req)
    }

    try {
      return validateUser(await auth.getAccessTokenContent(token), req)
    } catch (_e) {
      return validateUser(null, req)
    }
  }

  const validateUser = async (user: Maybe<AccessTokenContent>, req: Request): Promise<AccessTokenContent|never> => {
    const operation = req.body.query

    if (!user
      && !operation.includes('IntrospectionQuery')
      && !operation.includes('ApolloGetServiceDefinition')
    ) {
      throw new AuthenticationError('Access token not valid or outdated.')
    }

    return user || { userId: 'introspection', isPermanent: false, nickname: 'introspection' }
  }

  return resolveUserFn
}

export default createAuthMiddleware
