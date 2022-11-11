import jwt from 'jsonwebtoken'
import * as fs from 'fs'
import { AuthenticationError } from 'apollo-server'
import { AccessTokenContent, verifyAccessTokenContent } from '../types/AccessTokenContent'
import { createPublicKey } from 'crypto'

export const createAuthenticator = (): Authenticator => {
  const accessPublicKey = createPublicKey({
    key: fs.readFileSync('./accessKey.pem'),
  })
  const algorithm = 'RS256'

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

  return {
    getAccessTokenContent,
  } as Authenticator
}

export default createAuthenticator

export interface Authenticator {
  getAccessTokenContent: (token: string) => AccessTokenContent
}
