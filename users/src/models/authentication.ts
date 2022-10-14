import { User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { UserDatabase } from './database';
import { AuthenticationError } from 'apollo-server';
import { v4 } from 'uuid';
import { AccessTokenContent, verifyAccessToken } from '../types/accessTokenContent'
import { RefreshTokenContent, verifyRefreshToken } from '../types/refreshTokenContent'
import { AuthenticationDetails } from '../types/authenticationDetails'
import { UserAuth } from '../types/userAuth'
import axios from 'axios'
import { AuthMethod } from '../types/authMethod'
import { createPrivateKey, createPublicKey } from 'crypto';
import moment from 'moment/moment';
const keycloak = require('../../keycloak.json');

export function createAuthenticator(db: UserDatabase) : Authenticator {
  const accessKey = createPrivateKey({
    key: fs.readFileSync('./accessKey.pem'),
    passphrase: process.env.ACCESS_KEY_PASSPHRASE ?? '',
  });
  const accessPublicKey = createPublicKey({
    key: fs.readFileSync('./accessPublicKey.pem'),
  });
  const refreshKey = createPrivateKey({
    key: fs.readFileSync('./refreshKey.pem'),
    passphrase: process.env.REFRESH_KEY_PASSPHRASE ?? '',
  });
  const refreshPublicKey = createPublicKey({
    key: fs.readFileSync('./refreshPublicKey.pem'),
  });
  const tokenType = 'bearer';
  const accessExpiresIn = 15 * 60;
  const refreshExpiresIn = 10 * 4 * 15 * 60;
  const algorithm = 'RS256';

  const getKeycloakInfoFor = async (token: string) : Promise<UserAuth> => {
    const url = `${keycloak['auth-server-url']}/auth/realms/${keycloak.realm}/protocol/openid-connect/userinfo`;
    const config = {
      headers: {
        Authorization: token,
      },
    };

    try {
      const userInfo = await axios.get(url, config);

      return {
        userId: userInfo.data.sub,
        nickname: userInfo.data.name,
        isPermanent: false,
        authMethod: AuthMethod.KEYCLOAK,
      }
    } catch(e) {
      throw new AuthenticationError('Keycloak access token not valid or outdated.');
    }
  }

  const sliceToken = (token: string) => token.startsWith('Bearer')
    ? token.slice(6, token.length).replace(' ', '')
    : token;

  const getAccessTokenContent = (token: string) : AccessTokenContent => {
    try{
      const slicedToken = sliceToken(token)

      // @ts-ignore
      const content = jwt.verify(slicedToken, accessPublicKey, { algorithms: [algorithm] })
      verifyAccessToken(content)
      return content
    } catch (e) {
      throw new AuthenticationError('DD-Services access token not valid or outdated.');
    }
  }

  const getRefreshTokenContent = (token: string) : RefreshTokenContent => {
    try {
      // @ts-ignore
      const content = jwt.verify(token, refreshPublicKey, { algorithms: [algorithm] })
      verifyRefreshToken(content)
      return content
    } catch (e) {
      throw new AuthenticationError('DD-Services refresh token not valid or outdated.');
    }
  }

  const createAccessTokenFor = (user: User, expiresIn: number) : string =>{
    const accessContent : AccessTokenContent = {
      userId: user.id,
      nickname: user.nickname,
      isPermanent: user.isPermanent,
    }

    // @ts-ignore
    const token = jwt.sign(accessContent, accessKey, { algorithm, expiresIn })
    return token
  }

  const createRefreshTokenFor = async (user: User, expiresIn: number) : Promise<string> => {
    const refreshContent : RefreshTokenContent = {
      userId: user.id,
      refreshKey: v4(),
    };

    await db.updateUser(
      { id: user.id },
      {
        refreshKey: refreshContent.refreshKey,
        refreshEnd: moment().add(refreshExpiresIn, 's').toISOString(),
      },
    );

    // @ts-ignore
    return jwt.sign(refreshContent, refreshKey, { algorithm, expiresIn });
  }

  const createAuthFor = async (user: User,
                               accessTTL: number = accessExpiresIn,
                               refreshTTL: number = refreshExpiresIn) : Promise<AuthenticationDetails> => {
    const auth = {
      accessToken: createAccessTokenFor(user, accessTTL),
      expiresIn: accessExpiresIn,
      refreshExpiresIn: refreshExpiresIn,
      tokenType,
      refreshToken: await createRefreshTokenFor(user, refreshTTL),
    };

    return auth;
  };

  const checkAndRenew = async (token: string) : Promise<AuthenticationDetails> => {
    const refreshContent = getRefreshTokenContent(token);

    const user = await db.getUserBy(refreshContent.userId);
    if (!user) throw new AuthenticationError('User not found.');
    if (user.refreshKey !== refreshContent.refreshKey)
      throw new AuthenticationError('Token not valid for user.');

    return createAuthFor(user);
  }

  return {
    getKeycloakInfoFor,
    getAccessTokenContent,
    getRefreshTokenContent,
    createAuthFor,
    checkAndRenew,
  } as Authenticator
}

export default createAuthenticator

export interface Authenticator {
  getKeycloakInfoFor: (token: string) => Promise<UserAuth>,
  getAccessTokenContent: (token: string) => AccessTokenContent,
  getRefreshTokenContent: (token: string) => RefreshTokenContent,
  createAuthFor: (user: User, accessTTL?: number, refreshTTL?: number) => Promise<AuthenticationDetails>,
  checkAndRenew: (token: string) => Promise<AuthenticationDetails>,
}
