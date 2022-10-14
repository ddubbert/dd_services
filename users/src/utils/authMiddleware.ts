import { Authenticator } from '../models/authentication';
import { UserAuth } from '../types/userAuth';
import { AuthMethod } from '../types/authMethod';
import { AuthenticationError } from 'apollo-server';
import { Maybe } from '@graphql-tools/utils'

export const createAuthMiddleware = (auth: Authenticator) => {
  type Request = {
    headers: { authorization: string },
    body: {
      query: string,
    },
  }

  const getDDServiceAuthInfoFor = async (token: string) : Promise<UserAuth> => {
    return {
      ...auth.getAccessTokenContent(token),
      authMethod: AuthMethod.DD_SERVICES,
    }
  }

  const resolveUserFn = async (req: Request) : Promise<Maybe<UserAuth>> => {
    const token = req.headers.authorization;
    if (!token) return validateUser(null, req);

    try {
      return validateUser(await getDDServiceAuthInfoFor(token), req);
    } catch (_e) {
      try {
        return validateUser(await auth.getKeycloakInfoFor(token), req);
      } catch(er) {
        return validateUser(null, req);
      }
    }
  };

  const validateUser = async (user: UserAuth|null, req: Request) : Promise<Maybe<UserAuth>|never> => {
    const operation = req.body.query;

    if (!user
      && !operation.includes('IntrospectionQuery')
      && !operation.includes('ApolloGetServiceDefinition')
      && !operation.includes('createOrLoginUser')
      && !operation.includes('refreshAuth')
    ) throw new AuthenticationError(`Access token not valid or outdated.`);

    return user;
  };

  return resolveUserFn;
}

export default createAuthMiddleware
