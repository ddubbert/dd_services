import jwt from 'jsonwebtoken'
import * as fs from 'fs'
import { AuthenticationError } from 'apollo-server'
import { AccessTokenContent, verifyAccessTokenContent } from '../types/AccessTokenContent'
import { createPublicKey } from 'crypto'
import { Maybe } from '@graphql-tools/utils'
import { Request, RequestHandler } from 'express'

type ResolveUserFn = (req: Request) => Promise<AccessTokenContent|never>

const GATEWAY = { userId: 'gateway', nickname: 'gateway', isPermanent: false }

export const createAuthenticator = (): Authenticator => {
  const accessPublicKey = createPublicKey({
    key: fs.readFileSync('./accessKey.pem'),
  })
  const algorithm = 'RS256'

  const sliceToken = (token: string): string => token.startsWith('Bearer')
    ? token.slice(6, token.length).replace(' ', '')
    : token

  const isGatewayToken = (token: string): boolean => sliceToken(token) === process.env.GATEWAY_BEARER_TOKEN

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

  const resolveUser: ResolveUserFn = async (req: Request): Promise<AccessTokenContent|never> => {
    const token = req.headers.authorization
    if (!token) {
      return validateUser(null)
    }

    if (isGatewayToken(token)) {
      return validateUser(GATEWAY)
    }

    try {
      return validateUser(await getAccessTokenContent(token))
    } catch (_e) {
      return validateUser(null)
    }
  }

  const validateUser = async (user: Maybe<AccessTokenContent>): Promise<AccessTokenContent|never> => {
    if (!user) {
      throw new AuthenticationError('Access token not valid or outdated.')
    }

    return user
  }

  const expressMiddleware: RequestHandler = async (req, res, next) => {
    try {
      req.currentUser = await resolveUser(req)
      next()
    } catch (e) {
      next(e)
    }
  }

  return {
    getAccessTokenContent,
    isGatewayToken,
    resolveUser,
    expressMiddleware,
  } as Authenticator
}

export default createAuthenticator

export interface Authenticator {
  getAccessTokenContent: (token: string) => AccessTokenContent
  isGatewayToken: (token: string) => boolean
  resolveUser: (req: Request) => Promise<AccessTokenContent|never>
  expressMiddleware: RequestHandler
}
