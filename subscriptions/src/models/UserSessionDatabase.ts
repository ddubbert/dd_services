import moment from 'moment'
import { Prisma, PrismaClient, UserSession } from '@prisma/client'
import { DBFunction } from '../types/DBFunction'

export const createUserSessionDB = async (): Promise<UserSessionDatabase> => {
  const prisma = new PrismaClient()

  const getUserSessionBy = async (id: string | null | undefined): Promise<UserSession | null> =>
    id ? await createGetTransaction({ id })() : null

  const getUserSession = async (where: Prisma.UserSessionWhereInput): Promise<UserSession | null> =>
    await createGetTransaction(where)()

  const getUserSessions = async (where: Prisma.UserSessionWhereInput = {}): Promise<UserSession[] | null> =>
    await createGetManyTransaction(where)()

  const createUserSession = async (data: Prisma.UserSessionCreateInput): Promise<UserSession | never> =>
    (await prisma.userSession.create({ data }))

  const deleteUserSession = async (where: Prisma.UserSessionWhereUniqueInput): Promise<UserSession|never> =>
    (await prisma.userSession.delete({ where }))

  const deleteUserSessions = async (where: Prisma.UserSessionWhereInput): Promise<Prisma.BatchPayload|never> =>
    (await prisma.userSession.deleteMany({ where }))

  const updateUserSession = async (
    where: Prisma.UserSessionWhereUniqueInput,
    input: Prisma.UserSessionUpdateInput,
  ): Promise<UserSession|never> => await createUpdateTransaction(where, input)()

  const updateUserSessions =
    async (
      where: Prisma.UserSessionWhereInput,
      input: Prisma.UserSessionUpdateInput,
    ): Promise<Prisma.BatchPayload|never> => await createUpdateManyTransaction(where, input)()

  const createGetTransaction =
    (where: Prisma.UserSessionWhereInput): DBFunction<UserSession | null> =>
      () => prisma.userSession.findFirst({ where })

  const createGetManyTransaction =
    (where: Prisma.UserSessionWhereInput): DBFunction<UserSession[] | null> =>
      () => prisma.userSession.findMany({ where })

  const createUpdateTransaction = (
    where: Prisma.UserSessionWhereUniqueInput,
    input: Prisma.UserSessionUpdateInput,
  ): DBFunction<UserSession|never> =>
    () => {
      const data = { ...input, updatedAt: moment().toISOString() }

      return prisma.userSession.update({
        where,
        data,
      })
    }

  const createUpdateManyTransaction = (
    where: Prisma.UserSessionWhereInput,
    input: Prisma.UserSessionUpdateInput,
  ): DBFunction<Prisma.BatchPayload|never> =>
    () => {
      const data = { ...input, updatedAt: moment().toISOString() }

      return prisma.userSession.updateMany({
        where,
        data,
      })
    }

  return {
    getUserSession,
    getUserSessionBy,
    getUserSessions,
    createUserSession,
    deleteUserSession,
    deleteUserSessions,
    updateUserSession,
    updateUserSessions,
    createGetTransaction,
    createGetManyTransaction,
    createUpdateTransaction,
    createUpdateManyTransaction,
  } as UserSessionDatabase
}

export default createUserSessionDB

export interface UserSessionDatabase {
  getUserSessionBy: (id: string | null | undefined) => Promise<UserSession|null>
  getUserSession: (where?: Prisma.UserSessionWhereInput) => Promise<UserSession|null>
  getUserSessions: (where?: Prisma.UserSessionWhereInput) => Promise<UserSession[]|null>
  createUserSession: (input: Prisma.UserSessionCreateInput) => Promise<UserSession|never>
  deleteUserSession: (where: Prisma.UserSessionWhereUniqueInput) => Promise<UserSession|never>
  deleteUserSessions: (where: Prisma.UserSessionWhereInput) => Promise<Prisma.BatchPayload|never>
  updateUserSession: (where: Prisma.UserSessionWhereUniqueInput, input: Prisma.UserSessionUpdateInput) => Promise<UserSession|never>
  updateUserSessions: (where: Prisma.UserSessionWhereInput, input: Prisma.UserSessionUpdateInput) => Promise<Prisma.BatchPayload|never>
  createGetTransaction: (where: Prisma.UserSessionWhereInput) => DBFunction<UserSession | null>
  createGetManyTransaction: (where: Prisma.UserSessionWhereInput) => DBFunction<UserSession[] | null>
  createUpdateTransaction: (where: Prisma.UserSessionWhereUniqueInput, input: Prisma.UserSessionUpdateInput) => DBFunction<UserSession>
  createUpdateManyTransaction:
  (where: Prisma.UserSessionWhereInput, input: Prisma.UserSessionUpdateInput) => DBFunction<Prisma.BatchPayload>
}
