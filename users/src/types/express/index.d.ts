import { AccessTokenContent } from 'AccessTokenContent'
import { Express } from 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    currentUser?: AccessTokenContent
    currentUrl?: string
    headers: {
      authorization: string
      'x-forwarded-for': string
    }
    body: {
      query: string
    }
  }
}
