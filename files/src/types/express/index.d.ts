import { AccessTokenContent } from 'AccessTokenContent'
import { File } from '@prisma/client'
import {FileUploadRequest} from "../FileUploadRequest";

declare module "express-serve-static-core" {
  interface Request {
    currentUser?: AccessTokenContent
    currentUrl?: string
    file?: File
    allowedUploads?: FileUploadRequest[]
    headers: {
      authorization: string
      'x-forwarded-for': string
    }
    body: {
      query: string
    }
  }
}
