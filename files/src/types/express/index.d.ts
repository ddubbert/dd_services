import { AccessTokenContent } from 'AccessTokenContent'
import { Express } from 'express-serve-static-core'
import { File } from '@prisma/client'

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: AccessTokenContent
    currentUrl?: string
    file?: File
    headers: {
      authorization: string
      'x-forwarded-for': string
    }
    body: {
      query: string
    }
  }
}
