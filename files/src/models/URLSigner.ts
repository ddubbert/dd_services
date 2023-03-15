import signed from 'signed'
import * as fs from 'fs'
import { AccessTokenContent } from '../types/AccessTokenContent'
import { RequestHandler } from 'express'
import { AuthenticationError } from 'apollo-server'
import { UploadLinkDetails } from '../types/UploadLinkDetails'
import { File } from '@prisma/client'

export const BASE_FILE_URL = `http://${process.env.UPLOAD_HOST ?? 'localhost'}:${process.env.UPLOAD_PORT ?? 8081}`
const ttl = +(process.env.UPLOAD_LINK_TTL ?? 15 * 60)

const signature = signed({
  secret: fs.readFileSync('./signing.pem').toString()
})

export const createSigner = (): URLSigner => {
  const signUploadUrl = (user: AccessTokenContent, session?: string): UploadLinkDetails => {
    const sessionPostfix = session ? `/${session}` : ''
    const url = `${BASE_FILE_URL}/uploads${sessionPostfix}`
    return { url: signature.sign(url, { addr: user.userId, ttl }), ttl }
  }

  const buildDownloadUrl = (files: File[]): string => `${BASE_FILE_URL}/files?${
    files.reduce((acc, it, index) => `${acc}${(index === 0 ? '' : '&')}fileId=${it.id}`, '')
  }`

  const createUserRestrictedDownloadUrlForFiles = (user: AccessTokenContent, files: File[]): UploadLinkDetails => ({
    url: signature.sign(buildDownloadUrl(files), { addr: user.userId, ttl }),
    ttl,
  })

  const createTimeRestrictedDownloadUrlForFiles = (files: File[]): UploadLinkDetails => ({
    url: signature.sign(buildDownloadUrl(files), { ttl }),
    ttl,
  })

  const createDownloadUrlForFiles = (files: File[]): string =>
    signature.sign(buildDownloadUrl(files))

  const verifyMiddleware: RequestHandler = (req, res, next) => {
    const user = req.currentUser
    if (!user) {
      throw new AuthenticationError('Not authenticated.')
    }
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
    req.currentUrl = signature.verify(url, { addr: user.userId })
    next()
  }

  return {
    signUploadUrl,
    createDownloadUrlForFiles,
    createTimeRestrictedDownloadUrlForFiles,
    createUserRestrictedDownloadUrlForFiles,
    verifyMiddleware,
  } as URLSigner
}

export type URLSigner = {
  signUploadUrl: (user: AccessTokenContent, session?: string) => UploadLinkDetails
  createUserRestrictedDownloadUrlForFiles: (user: AccessTokenContent, files: File[]) => UploadLinkDetails
  createTimeRestrictedDownloadUrlForFiles: (files: File[]) => UploadLinkDetails
  createDownloadUrlForFiles: (files: File[]) => string
  verifyMiddleware: RequestHandler
}
