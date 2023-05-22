import { GraphQLDateTime } from 'graphql-iso-date'
import { File, Prisma } from '@prisma/client'
import { FieldResolverFn } from '../types/ResolverFn'
import { depthLimitedFieldResolver, depthLimitedReferenceResolver } from '../utils/PathReader'
import { DeletionStatus } from '../types/DeletionStatus'
import { FileFilter } from '../types/FileFilter'
import {
  FileAmountError,
  FileSizeError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UploadSpaceError
} from '../types/Errors'
import { FileType, getFileTypeFrom } from '../types/FileType'
import { getFileIfUserHasPermissions, userIsMemberInAllSessions } from '../utils/AuthorizationHelper'
import { FileDatabase } from '../models/FileDatabase'

const MAX_SESSION_UPLOAD_SPACE_IN_BYTE = +(process.env.MAX_SESSION_UPLOAD_SPACE_IN_BYTE ?? 1000000 * 100)
const MAX_USER_UPLOAD_SPACE_IN_BYTE = +(process.env.MAX_USER_UPLOAD_SPACE_IN_BYTE ?? 1000000 * 100)
const MAX_FILE_SIZE = +(process.env.MAX_FILE_SIZE ?? 1000000 * 10)
const MAX_FILE_UPLOAD_AMOUNT = +(process.env.MAX_FILE_UPLOAD_AMOUNT ?? 12)

const calculateRemainingUploadSpace = async (fileDB: FileDatabase, userId: string, sessionId?: string): Promise<number> => {
  const userFiles: File[] = await fileDB.getFiles({
    creator: userId,
    sessions: sessionId == null ? { isEmpty: true } : { has: sessionId },
  })
  console.log(sessionId == null ? 'no sessionId provided' : 'sessionId provided')
  console.log(userFiles)

  const spaceUsed = userFiles.reduce((acc, it) => acc + it.size, 0)
  const maxSpace = sessionId == null ? MAX_USER_UPLOAD_SPACE_IN_BYTE : MAX_SESSION_UPLOAD_SPACE_IN_BYTE
  return maxSpace - spaceUsed
}

export default {
  DateTime: GraphQLDateTime,
  FileType,
  Query: {
    getAllFilesOfUser: (async (parent, args, context) => {
      const { userId } = context.currentUser
      const filter = args.filter as FileFilter
      const where = { ...filter, owner: userId } as Prisma.FileWhereInput
      return await context.fileDB.getFiles(where)
    }) as FieldResolverFn,
    getAllFilesOfSession: (async (parent, args, context) => {
      const { userId } = context.currentUser
      const { sessionId } = args

      if (!(await userIsMemberInAllSessions([ sessionId ], userId, context.userSessionDB))) {
        throw new ForbiddenError('User is not authorized to access files of this session.')
      }

      const filter = args.filter as FileFilter
      const where = { ...filter, sessions: { has: sessionId } } as Prisma.FileWhereInput
      return await context.fileDB.getFiles(where)
    }) as FieldResolverFn,
    getFile: (async (parent, args, context) => {
      const { userId } = context.currentUser
      const { fileId } = args
      return await getFileIfUserHasPermissions(fileId, userId, context.fileDB, context.userSessionDB)
    }) as FieldResolverFn,
    getDownloadLinkForFilesOfSession: (async (parent, args, context) => {
      if (!await userIsMemberInAllSessions([ args.sessionId ], context.currentUser.userId, context.userSessionDB)) {
        throw new ForbiddenError('User is not authorized to access files of this session.')
      }

      const files = await context.fileDB.getFiles({ sessions: { has: args.sessionId } })
      if (files.length === 0) {
        throw new NotFoundError('No files found for this session.')
      }

      return context.signer.createUserRestrictedDownloadUrlForFiles(context.currentUser, files)
    }) as FieldResolverFn,
    getDownloadLinkForFilesOfUser: (async (parent, args, context) => {
      const files = await context.fileDB.getFiles({ owner: context.currentUser.userId })
      if (files.length === 0) {
        throw new NotFoundError('No files found for this user.')
      }

      return context.signer.createUserRestrictedDownloadUrlForFiles(context.currentUser, files)
    }) as FieldResolverFn,
    getFileUploadLink: (async (parent, args, context) =>
      context.signer.signUploadUrl(context.currentUser, args.sessionId)
    ) as FieldResolverFn,
    getSignedFileUploadLink: (async (parent, args, context) => {
      const { sessionId, files } = args
      if (sessionId == null && !context.currentUser.isPermanent) {
        throw new ForbiddenError('File upload without session is only allowed to logged in users.')
      }
      if (files.length > MAX_FILE_UPLOAD_AMOUNT) {
        throw new FileAmountError(MAX_FILE_UPLOAD_AMOUNT, files.length)
      }

      const requestedSpace = files.reduce((acc, it) => {
        if (it.size > MAX_FILE_SIZE) {
          throw new FileSizeError(MAX_FILE_SIZE, it)
        }
        return acc + it.size
      }, 0)

      const remainingSpace = await calculateRemainingUploadSpace(
        context.fileDB,
        context.currentUser.userId,
        sessionId,
      )

      if (remainingSpace < requestedSpace) {
        throw new UploadSpaceError(remainingSpace, requestedSpace)
      }

      return context.signer.createSignedUploadUrl(context.currentUser, files, sessionId)
      // context.signer.signUploadUrl(context.currentUser, args.sessionId)
    }) as FieldResolverFn,
  },
  Mutation: {
    addFileToSession: (async (parent, args, context) => {
      const { userId } = context.currentUser
      const { sessionId, fileId } = args
      const file = await getFileIfUserHasPermissions(fileId, userId, context.fileDB, context.userSessionDB)

      if (file.sessions.includes(sessionId)) {
        return file
      }
      if (!(await userIsMemberInAllSessions([ sessionId ], userId, context.userSessionDB))) {
        throw new ForbiddenError('User is not authorized to add files to this session.')
      }

      return await context.fileDB.updateFile({ id: fileId }, { sessions: { push: sessionId } })
    }) as FieldResolverFn,
    copyFile: (async (parent, args, context) => {
      const { userId } = context.currentUser
      const { fileId } = args
      const oldFile = await getFileIfUserHasPermissions(fileId, userId, context.fileDB, context.userSessionDB)

      const newId = context.uploadHandler.copyFile(oldFile.localId)
      const fileInput = {
        localId: newId,
        name: oldFile.name,
        description: oldFile.description,
        type: oldFile.type,
        size: oldFile.size,
        owner: context.currentUser.userId,
        creator: context.currentUser.nickname,
        permanent: true,
      }

      try {
        return await context.fileDB.createFile(fileInput)
      } catch (e) {
        context.uploadHandler.deleteFiles([ newId ])
        throw new InternalServerError('Could not be copied. Please try again.')
      }
    }) as FieldResolverFn,
    removeFileFromSession: (async (parent, args, context) => {
      const { userId, nickname } = context.currentUser
      const { sessionId, fileId } = args
      const file = await getFileIfUserHasPermissions(fileId, userId, context.fileDB, context.userSessionDB)

      if (!file.sessions.includes(sessionId)) {
        return file
      }
      if (userId !== file.owner && nickname !== file.creator
        && !(await userIsMemberInAllSessions([ sessionId ], userId, context.userSessionDB))) {
        throw new ForbiddenError('User is not authorized to remove files from this session.')
      }

      const newFileSessions = file.sessions.filter(it => it !== sessionId)
      try {
        await context.fileDB.updateFile({ id: fileId }, { sessions: { set: newFileSessions } })
        return { status: DeletionStatus.SUCCESSFUL }
      } catch {
        return { status: DeletionStatus.UNSUCCESSFUL }
      }
    }) as FieldResolverFn,
    deleteFile: (async (parent, args, context) => {
      const { userId, nickname } = context.currentUser
      const { fileId } = args
      const file = await getFileIfUserHasPermissions(fileId, userId, context.fileDB, context.userSessionDB)

      if (userId !== file.owner && nickname !== file.creator) {
        throw new ForbiddenError('User is not authorized to delete this file.')
      }

      try {
        await context.fileDB.deleteFile({ id: fileId })
        return { status: DeletionStatus.SUCCESSFUL }
      } catch {
        return { status: DeletionStatus.UNSUCCESSFUL }
      }
    }) as FieldResolverFn,
  },
  File: {
    __resolveReference: depthLimitedReferenceResolver(
      async (file, context) => await context.fileDB.getFileBy(file.id)
    ),
    owner: (async (parent) => (parent.owner ? { id: parent.owner } : null)) as FieldResolverFn,
    type: (async (parent) => (getFileTypeFrom(parent.type))) as FieldResolverFn,
    mimetype: (async (parent) => parent.type) as FieldResolverFn,
    downloadLink: (async (parent, args, context) =>
      context.signer.createDownloadUrlForFiles([ parent as File ])
    ) as FieldResolverFn,
    sessions: (async (parent) => (
      parent.sessions.length ? parent.sessions.map(it => ({ id: it })) : null)
    ) as FieldResolverFn,
  },
  User: {
    files: depthLimitedFieldResolver(
      async (user, args, context) => {
        if (user.id !== context.currentUser.userId) {
          throw new ForbiddenError('User is not authorized to view files of requested user.')
        }
        const files: File[] = await context.fileDB.getFiles({ owner: user.id })
        return !files.length ? null : files
      }
    ),
  },
  Session: {
    files: depthLimitedFieldResolver(
      async (session, args, context) => {
        let files: File[] = []
        if ((await userIsMemberInAllSessions([ session.id ], context.currentUser.userId, context.userSessionDB))) {
          files = await context.fileDB.getFiles({ sessions: { has: session.id } })
        }
        return !files.length ? null : files
      }
    ),
  },
}
