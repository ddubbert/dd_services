import signed from 'signed'
import * as fs from 'fs'
import { AccessTokenContent } from '../types/AccessTokenContent'
import { RequestHandler } from 'express'
import { UploadLinkDetails } from '../types/UploadLinkDetails'
import { File } from '@prisma/client'
import { FileUploadRequest, verifyFileUploadRequestArray } from '../types/FileUploadRequest'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import qs from 'qs'
import { InternalServerError } from '../types/Errors'

export const BASE_FILE_URL = `http://${process.env.UPLOAD_HOST ?? 'localhost'}:${process.env.UPLOAD_PORT ?? 8081}`

const ttl = +(process.env.UPLOAD_LINK_TTL ?? 15 * 60)
const algorithm = 'aes-256-cbc'
const initVector = randomBytes(16)
const cryptoSecret = randomBytes(32)
const outputEncoding = 'hex'
const inputEncoding = 'utf8'

const signature = signed({
  secret: fs.readFileSync('./signing.pem').toString()
})

export const createSigner = (): URLSigner => {
  const signUploadUrl = (user: AccessTokenContent, session?: string): UploadLinkDetails => {
    const sessionPostfix = session ? `/${session}` : ''
    const url = `${BASE_FILE_URL}/uploads${sessionPostfix}`
    return { url: signature.sign(url, { addr: user.userId, ttl, method: 'post' }), ttl }
  }

  const createSignedUploadUrl = (
    user: AccessTokenContent,
    files: FileUploadRequest[],
    session?: string): UploadLinkDetails => {
    const sessionPostfix = session ? `/${session}` : ''
    const fileString = qs.stringify(files, { encode: false })

    const cipher = createCipheriv(algorithm, cryptoSecret, initVector)
    let encrypted = cipher.update(fileString, inputEncoding, outputEncoding)
    encrypted += cipher.final(outputEncoding)

    const url = `${BASE_FILE_URL}/uploads${sessionPostfix}?files=${encrypted}`

    return { url: signature.sign(url, { addr: user.userId, ttl, method: 'post' }), ttl }
  }

  const buildDownloadUrl = (files: File[]): string => `${BASE_FILE_URL}/files?${
    files.reduce((acc, it, index) => `${acc}${(index === 0 ? '' : '&')}fileId=${it.id}`, '')
  }`

  const createUserRestrictedDownloadUrlForFiles = (user: AccessTokenContent, files: File[]): UploadLinkDetails => ({
    url: signature.sign(buildDownloadUrl(files), { addr: user.userId, ttl, method: 'get' }),
    ttl,
  })

  const createTimeRestrictedDownloadUrlForFiles = (files: File[]): UploadLinkDetails => ({
    url: signature.sign(buildDownloadUrl(files), { ttl, method: 'get' }),
    ttl,
  })

  const createDownloadUrlForFiles = (files: File[]): string =>
    signature.sign(buildDownloadUrl(files), { method: 'get' })

  const verifySignature: RequestHandler = (req, res, next) => {
    const user = req.currentUser
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
    req.currentUrl = signature.verify(url, { addr: user.userId, method: req.method })
    next()
  }

  const decipherAllowedUploads: RequestHandler = (req, res, next) => {
    const currentUrl = req.currentUrl
    const queryString = req.query.files
    if (currentUrl == null) {
      throw new InternalServerError('file decryption middleware needs to be called after signature verifying middleware.')
    }

    if (queryString != null) {
      const decipher = createDecipheriv(algorithm, cryptoSecret, initVector)
      let decrypted = decipher.update(queryString as string, outputEncoding, inputEncoding)
      decrypted += decipher.final(inputEncoding)
      const queryFiles = Object.values(qs.parse(decrypted))
      verifyFileUploadRequestArray(queryFiles)
      req.allowedUploads = queryFiles
    }
    next()
  }

  return {
    signUploadUrl,
    createSignedUploadUrl,
    createDownloadUrlForFiles,
    createTimeRestrictedDownloadUrlForFiles,
    createUserRestrictedDownloadUrlForFiles,
    verifySignature,
    decipherAllowedUploads,
  } as URLSigner
}

export type URLSigner = {
  signUploadUrl: (user: AccessTokenContent, session?: string) => UploadLinkDetails
  createSignedUploadUrl: (user: AccessTokenContent, files: FileUploadRequest[], session?: string) => UploadLinkDetails
  createUserRestrictedDownloadUrlForFiles: (user: AccessTokenContent, files: File[]) => UploadLinkDetails
  createTimeRestrictedDownloadUrlForFiles: (files: File[]) => UploadLinkDetails
  createDownloadUrlForFiles: (files: File[]) => string
  verifySignature: RequestHandler
  decipherAllowedUploads: RequestHandler
}
