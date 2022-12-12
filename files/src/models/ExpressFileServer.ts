import { FileDatabase } from './FileDatabase'
import { UserSessionDatabase } from './UserSessionDatabase'
import { UploadHandler } from './UploadHandler'
import { Authenticator } from './Authenticator'
import { URLSigner } from './URLSigner'
import express, { RequestHandler } from 'express'
import multer from 'multer'
import { FILE_TEMP_FOLDER } from '../types/FilePath'
import { fileTypeIsValid } from '../types/FileType'
import { createDownloadHandler } from './DownloadHandler'
import cors from 'cors'
import { getFileIfUserHasPermissions, userIsMemberInAllSessions } from '../utils/AuthorizationHelper'
import { ForbiddenError, NotFoundError } from '../types/Errors'
import http from 'http'
import { v4 } from 'uuid'

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
    fileFilter: (req, file, cb) => cb(null, fileTypeIsValid(file.mimetype)),
    limits: {
      fileSize: 1000 * 1000000,
    },
  })
  const downloader = createDownloadHandler()

  app.get(
    '/files/:fileId',
    cors<cors.CorsRequest>(),
    auth.expressMiddleware,
    signer.verifyMiddleware,
    (async (req, res, next) => {
      try {
        const user = req.currentUser
        const fileId = req.params.fileId

        const file = await getFileIfUserHasPermissions(fileId, user.userId, fileDB, userSessionDB)
        await downloader.downloadFile(res, file)
      } catch (e) {
        next(e)
      }
    }) as RequestHandler
  )

  app.post(
    '/uploads/:sessionId?',
    cors<cors.CorsRequest>(),
    auth.expressMiddleware,
    signer.userRestrictedVerifyMiddleware,
    uploader.array('file_uploads', 12),
    (async (req, res, next) => {
      try {
        const files = req.files
        const user = req.currentUser

        if (!files) { throw new NotFoundError('No files found.') }

        await uploadHandler.publishUploads({
          uploads: Array.isArray(files) ? files : files.file_uploads,
          user,
          session: req.params.sessionId,
        })

        res.send('success')
      } catch (e) {
        next(e)
      }
    }) as RequestHandler,
  )

  app.get(
    '/files/sessions/:sessionId',
    cors<cors.CorsRequest>(),
    auth.expressMiddleware,
    signer.userRestrictedVerifyMiddleware,
    (async (req, res, next) => {
      try {
        const user = req.currentUser
        const { sessionId } = req.params

        if (!await userIsMemberInAllSessions([ sessionId ], user.userId, userSessionDB)) {
          throw new ForbiddenError('User is not authorized to access files of this session.')
        }

        const files = await fileDB.getFiles({ sessions: { has: sessionId } })
        if (files.length <= 0) {
          next(new NotFoundError('No files found for this session.'))
        }

        await downloader.downloadFiles(res, files, sessionId)
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
