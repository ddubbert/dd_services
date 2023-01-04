import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { FileDatabase } from '../models/FileDatabase'
import { File } from '@prisma/client'
import { ForbiddenError } from '../types/Errors'

export const userIsMemberInAllSessions = async (
  sessions: string[],
  user: string,
  db: UserSessionDatabase): Promise<boolean> => {
  const userSessions = await db.getUserSessions({ session: { in: sessions } })
  console.log(userSessions)
  console.log(user)
  console.log(sessions)
  return userSessions?.reduce((acc, it) => acc && it.users.includes(user), true) ?? false
}

export const userIsMemberInAnySession = async (
  sessions: string[],
  user: string,
  db: UserSessionDatabase): Promise<boolean> => {
  const userSessions = await db.getUserSessions({ session: { in: sessions } })

  return userSessions?.reduce((acc, it) => acc || it.users.includes(user), false) ?? false
}

export const getFileIfUserHasPermissions = async (
  fileId: string,
  userId: string,
  fileDB: FileDatabase,
  userSessionDB: UserSessionDatabase): Promise<File|never> => {
  const file = await fileDB.getFileBy(fileId)

  if (
    !file
    || (file.owner !== userId
      && (!(await userIsMemberInAnySession(file.sessions, userId, userSessionDB)))
    )
  ) {
    throw new ForbiddenError('User is not authorized to access files of this session.')
  }

  return file
}
