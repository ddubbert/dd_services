import {
  useGenericAuth,
  ResolveUserFn,
  ValidateUserFn,
  UnauthenticatedError,
} from '@envelop/generic-auth';
import axios from 'axios';

const keycloak = require('../../keycloak.json');

type UserType = {
  id: string,
}

const resolveUserFn: ResolveUserFn<UserType> = async (context) => {
  try {
    console.log("AUTH:")
    // @ts-ignore
    console.log(context.req.headers)
    // @ts-ignore
    const token = context.req.headers.authorization;
    if (!token) return null;

    const url = `${keycloak['auth-server-url']}realms/${keycloak.realm}/protocol/openid-connect/userinfo`;
    const config = {
      headers: {
        Authorization: token,
      },
    };

    const userInfo = await axios.get(url, config);

    // @ts-ignore
    return { id: userInfo.data.sub };
  } catch (e) {
    return null;
  }
};

const validateUser: ValidateUserFn<UserType> = (params) => {
  console.log("Wurde aufgerufen:")
  console.log(params)
  const user = params.user;
  const operation = params.executionArgs.operationName;
  if (!user
  // @ts-ignore
  //   && operation !== 'IntrospectionQuery'
  // @ts-ignore
    && operation !== 'getSession') {
    throw new UnauthenticatedError(`Unauthenticated!`);
  }
};

const createKeycloakAuth = () => {
  return useGenericAuth({
    resolveUserFn,
    validateUser,
    mode: 'protect-all',
  });
}

export const keycloakAuth = createKeycloakAuth()

export default createKeycloakAuth()
