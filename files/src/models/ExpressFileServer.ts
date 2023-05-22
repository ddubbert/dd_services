import { FileDatabase } from './FileDatabase'
import { UserSessionDatabase } from './UserSessionDatabase'
import { UploadHandler } from './UploadHandler'
import { Authenticator } from './Authenticator'
import { URLSigner } from '../utils/URLSigner'
import express, { Request, RequestHandler } from 'express'
import multer from 'multer'
import { FILE_TEMP_FOLDER } from '../types/FilePath'
import { fileTypeIsValid } from '../types/FileType'
import { createDownloadHandler } from './DownloadHandler'
import cors from 'cors'
import {
  BadRequestError,
  FileSizeError,
  FileSizeMismatchError,
  InternalServerError,
  NotFoundError
} from '../types/Errors'
import http from 'http'
import { v4 } from 'uuid'
import { FileUploadRequest } from '../types/FileUploadRequest'
import { Maybe } from '@graphql-tools/utils'

const MAX_FILE_UPLOAD_AMOUNT = +(process.env.MAX_FILE_UPLOAD_AMOUNT ?? 12)
const MAX_FILE_SIZE = +(process.env.MAX_FILE_SIZE ?? 1000000 * 10)

const matchingFile = (file: FileUploadRequest, files: FileUploadRequest[]): Maybe<FileUploadRequest> => files.find(it =>
  it.name === file.name && it.mimetype === file.mimetype
)

const uploadAllowed = (req: Request, file: Express.Multer.File): boolean => {
  console.log(file)
  const { allowedUploads } = req
  if (allowedUploads == null) {
    throw new InternalServerError('No allowed file uploads found in the request.')
  }

  const fileRequest: FileUploadRequest = { name: file.originalname, mimetype: file.mimetype, size: file.size }
  return matchingFile(fileRequest, allowedUploads) !== undefined
}

export const startExpressFileServer = async (
  fileDB: FileDatabase,
  userSessionDB: UserSessionDatabase,
  auth: Authenticator,
  signer: URLSigner,
  uploadHandler: UploadHandler,
): Promise<void> => {
  const app = express()
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, FILE_TEMP_FOLDER)
    },
    filename: (req, file, cb) => {
      cb(null, v4())
    }
  })
  const uploader = multer({
    storage,
    fileFilter: (req, file, cb) =>
      cb(null, fileTypeIsValid(file.mimetype) && uploadAllowed(req, file)),
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  })
  const downloader = createDownloadHandler()

  app.get(
    '/files',
    cors<cors.CorsRequest>(),
    auth.expressMiddleware,
    signer.verifySignature,
    (async (req, res, next) => {
      try {
        const ids = req.query.fileId
        if (!ids) {
          next(new BadRequestError('No file ids provided.'))
        }

        const fileIds = Array.isArray(ids) ? ids : [ ids ]

        const files = await fileDB.getFiles({ id: { in: fileIds as string[] } })

        if (files.length === 0) {
          next(new NotFoundError('No file found.'))
        } else if (files.length === 1) {
          await downloader.downloadFile(res, files[0])
        } else {
          await downloader.downloadFiles(res, files, 'files')
        }
      } catch (e) {
        next(e)
      }
    }) as RequestHandler
  )

  const verifyFileSizes: RequestHandler = (req, res, next) => {
    const { allowedUploads, files } = req
    if (allowedUploads == null) { throw new InternalServerError('No allowed file uploads found in the request.') }
    if (files == null) { throw new NotFoundError('No files found.') }

    const uploads = Array.isArray(files) ? files : files.file_uploads
    if (uploads.length === 0) { throw new BadRequestError('No allowed file uploads provided.') }

    uploads.forEach(it => {
      console.log(it)
      const file: FileUploadRequest = { name: it.originalname, mimetype: it.mimetype, size: it.size }
      const allowedUpload = matchingFile(file, allowedUploads)

      if (allowedUpload == null) { throw new BadRequestError(`Uploading file "${file.name}" has not been allowed before.`) }
      if (file.size > allowedUpload.size * 1.01 || file.size < allowedUpload.size * 0.99) {
        uploadHandler.rejectFiles(uploads)
        throw new FileSizeMismatchError(allowedUpload.size, file)
      }
    })
    next()
  }

  app.post(
    '/uploads/:sessionId?',
    cors<cors.CorsRequest>(),
    auth.expressMiddleware,
    signer.verifySignature,
    signer.decipherAllowedUploads,
    uploader.array('file_uploads', MAX_FILE_UPLOAD_AMOUNT),
    verifyFileSizes,
    (async (req, res, next) => {
      try {
        const files = req.files
        const user = req.currentUser

        if (!files) { throw new NotFoundError('No files found.') }
        const uploads = Array.isArray(files) ? files : files.file_uploads
        if (uploads.length === 0) { throw new BadRequestError('No allowed file uploads provided.') }

        await uploadHandler.publishUploads({
          uploads,
          user,
          session: req.params.sessionId,
        })

        res.send('success')
      } catch (e) {
        next(e)
      }
    }) as RequestHandler,
  )

  const uploadServer = http.createServer(app)
  await new Promise<void>((resolve) => uploadServer.listen({
    port: process.env.UPLOAD_PORT ?? 8081,
  }, resolve)).then((): void => {
    console.log(`🚀 Server ready at http://${process.env.UPLOAD_HOST}:${process.env.UPLOAD_PORT}`)
  }).catch((err): void => {
    console.error(err)
    throw err
  })
}
