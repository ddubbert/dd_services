import { User } from '@prisma/client'
import jwt from 'jsonwebtoken'
import * as fs from 'fs'
import { UserDatabase } from './UserDatabase'
import { AuthenticationError } from 'apollo-server'
import { v4 } from 'uuid'
import { AccessTokenContent, verifyAccessTokenContent } from '../types/auth/AccessTokenContent'
import { RefreshTokenContent, verifyRefreshTokenContent } from '../types/auth/RefreshTokenContent'
import { AuthenticationDetails } from '../types/auth/AuthenticationDetails'
import { UserAuth } from '../types/auth/UserAuth'
import axios from 'axios'
import { AuthMethod } from '../types/auth/AuthMethod'
import { createPrivateKey, createPublicKey } from 'crypto'
import moment from 'moment/moment'
const keycloak = require('../../keycloak.json')

export const createAuthenticator = (db: UserDatabase): Authenticator => {
  const accessKey = createPrivateKey({
    key: fs.readFileSync('./accessKey.pem'),
    passphrase: process.env.ACCESS_KEY_PASSPHRASE ?? '',
  })
  const accessPublicKey = createPublicKey({
    key: fs.readFileSync('./accessPublicKey.pem'),
  })
  const refreshKey = createPrivateKey({
    key: fs.readFileSync('./refreshKey.pem'),
    passphrase: process.env.REFRESH_KEY_PASSPHRASE ?? '',
  })
  const refreshPublicKey = createPublicKey({
    key: fs.readFileSync('./refreshPublicKey.pem'),
  })
  const tokenType = 'bearer'
  const accessExpiresIn = 15 * 60 // In seconds
  const refreshExpiresIn = 4 * 15 * 60 // In seconds
  const algorithm = 'RS256'

  const getKeycloakInfoFor = async (token: string): Promise<UserAuth> => {
    const url = `${keycloak['auth-server-url']}/auth/realms/${keycloak.realm}/protocol/openid-connect/userinfo`
    const config = {
      headers: {
        Authorization: token,
      },
    }

    try {
      const userInfo = await axios.get(url, config)

      return {
        userId: userInfo.data.sub,
        nickname: userInfo.data.name,
        isPermanent: false,
        email: userInfo.data.email,
        authMethod: AuthMethod.KEYCLOAK,
      }
    } catch (e) {
      throw new AuthenticationError('Keycloak access token not valid or outdated.')
    }
  }

  const sliceToken = (token: string): string => token.startsWith('Bearer')
    ? token.slice(6, token.length).replace(' ', '')
    : token

  const getAccessTokenContent = (token: string): AccessTokenContent => {
    try{
      const slicedToken = sliceToken(token)

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const content = jwt.verify(slicedToken, accessPublicKey, { algorithms: [ algorithm ] })
      verifyAccessTokenContent(content)
      return content
    } catch (e) {
      throw new AuthenticationError('DD-Services access token not valid or outdated.')
    }
  }

  const getRefreshTokenContent = (token: string): RefreshTokenContent => {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const content = jwt.verify(token, refreshPublicKey, { algorithms: [ algorithm ] })
      verifyRefreshTokenContent(content)
      return content
    } catch (e) {
      throw new AuthenticationError('DD-Services refresh token not valid or outdated.')
    }
  }

  const createAccessTokenFor = (user: User, expiresIn: number): string => {
    const accessContent: AccessTokenContent = {
      userId: user.id,
      nickname: user.nickname,
      isPermanent: user.isPermanent,
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const token = jwt.sign(accessContent, accessKey, { algorithm, expiresIn })
    return token
  }

  const createRefreshTokenFor = async (user: User, expiresIn: number): Promise<string> => {
    const refreshContent: RefreshTokenContent = {
      userId: user.id,
      refreshKey: v4(),
    }

    await db.updateUser(
      { id: user.id },
      {
        refreshKey: refreshContent.refreshKey,
        refreshEnd: moment().add(refreshExpiresIn, 's').toISOString(),
      },
    )

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return jwt.sign(refreshContent, refreshKey, { algorithm, expiresIn })
  }

  const createAuthFor = async (user: User,
                               accessTTL: number = accessExpiresIn,
                               refreshTTL: number = refreshExpiresIn): Promise<AuthenticationDetails> => {
    const auth = {
      accessToken: createAccessTokenFor(user, accessTTL),
      expiresIn: accessExpiresIn,
      refreshExpiresIn,
      tokenType,
      refreshUri: `http://${process.env.HOST}:${process.env.PORT}/graphql`,
      refreshToken: await createRefreshTokenFor(user, refreshTTL),
    }

    return auth
  }

  const getVerifiedAccessTokenContent = async (token: string): Promise<AccessTokenContent|never> => {
    const content = getAccessTokenContent(token)
    try {
      await db.getUserBy(content.userId)
      return content
    } catch (_e) {
      throw new AuthenticationError('User doesn´t exist.')
    }
  }

  const verifyAndRenewAuth = async (refreshToken: string): Promise<AuthenticationDetails> => {
    const refreshContent = getRefreshTokenContent(refreshToken)

    const user = await db.getUserBy(refreshContent.userId)
    if (!user) {throw new AuthenticationError('User not found.')}
    if (user.refreshKey !== refreshContent.refreshKey)
    {throw new AuthenticationError('Token not valid for user.')}

    return createAuthFor(user)
  }

  return {
    getKeycloakInfoFor,
    getAccessTokenContent,
    getRefreshTokenContent,
    createAuthFor,
    verifyAndRenewAuth,
    getVerifiedAccessTokenContent,
  } as Authenticator
}

export default createAuthenticator

export interface Authenticator {
  getKeycloakInfoFor: (token: string) => Promise<UserAuth>
  getAccessTokenContent: (token: string) => AccessTokenContent
  getRefreshTokenContent: (token: string) => RefreshTokenContent
  createAuthFor: (user: User, accessTTL?: number, refreshTTL?: number) => Promise<AuthenticationDetails>
  verifyAndRenewAuth: (refreshToken: string) => Promise<AuthenticationDetails>
  getVerifiedAccessTokenContent: (token: string) => Promise<AccessTokenContent|never>
}
