import moment from 'moment'
import { Prisma, PrismaClient, User } from '@prisma/client'
import { ChangeStream, MongoClient } from 'mongodb'
import EventHandler from './EventHandler'
import { MessageEvent } from '../types/kafka/EventMessage'
import { EntityType } from '../types/kafka/Entity'
import { KafkaTopic } from '../types/kafka/KafkaTopic'

export const createUserDB = async (events: EventHandler): Promise<UserDatabase> => {
  const prisma = new PrismaClient()
  let mongo: MongoClient
  let usersChangeStream: ChangeStream

  const setupDatabaseEvents = async (): Promise<void> => {
    const dbUrl = process.env.DB_URL
    if (!dbUrl) {throw new Error('No DB_URL provided in environment.')}

    mongo = new MongoClient(dbUrl)

    const dbName = process.env.DB_DATABASE
    if (!dbName) {throw new Error('No DB_DATABASE provided in environment.')}

    const database = mongo.db(dbName)
    const collection = database.collection('users')
    usersChangeStream = collection.watch([], {
      fullDocumentBeforeChange: 'required',
      fullDocument: 'updateLookup',
    })

    usersChangeStream.on('change', async next => {
      switch (next.operationType) {
      case 'insert': {
        await events.send(KafkaTopic.USERS, [ {
          event: MessageEvent.CREATED,
          entity: {
            type: EntityType.USER,
            id: next.documentKey._id.toString(),
          }
        } ])
        break
      }
      case 'update': {
        await events.send(KafkaTopic.USERS, [ {
          event: MessageEvent.UPDATED,
          entity: {
            type: EntityType.USER,
            id: next.documentKey._id.toString(),
          }
        } ])
        break
      }
      case 'delete': {
        await events.send(KafkaTopic.USERS, [ {
          event: MessageEvent.DELETED,
          entity: {
            type: EntityType.USER,
            id: next.documentKey._id.toString(),
          }
        } ])
        break
      }
      default: {
        break
      }
      }
    })
  }

  const createDeletionIndex = async (): Promise<Prisma.JsonObject> =>
    await prisma.$runCommandRaw({
      createIndexes: 'users',
      indexes: [
        {
          key: { refreshEnd: 1 },
          name: 'ExpirationIndex',
          expireAfterSeconds: 0,
          partialFilterExpression: { isPermanent: false },
        },
      ],
    })

  const getUserBy = async (id: string): Promise<User|null> => (await prisma.user.findFirst({ where: { id } }))

  const getUser = async (where: Prisma.UserWhereInput): Promise<User|null> =>
    (await prisma.user.findFirst({ where }))

  const getUsers = async (where: Prisma.UserWhereInput = {}): Promise<User[]|null> =>
    (await prisma.user.findMany({ where }))

  const createUser = async (input: Prisma.UserCreateInput): Promise<User|never> =>
    (await prisma.user.create({ data: input }))

  const deleteUser = async (where: Prisma.UserWhereUniqueInput): Promise<User|never> =>
    (await prisma.user.delete({ where }))

  const deleteUsers = async (where: Prisma.UserWhereInput): Promise<Prisma.BatchPayload|never> =>
    (await prisma.user.deleteMany({ where }))

  const updateUser = async (where: Prisma.UserWhereUniqueInput, input: Prisma.UserUpdateInput): Promise<User|never> => {
    const data = { ...input, updatedAt: moment().toISOString() }

    return await prisma.user.update({
      where,
      data,
    })
  }

  const updateUsers =
    async (where: Prisma.UserWhereInput, input: Prisma.UserUpdateInput): Promise<Prisma.BatchPayload|never> => {
      const data = { ...input, updatedAt: moment().toISOString() }

      return await prisma.user.updateMany({
        where,
        data,
      })
    }

  console.log(await createDeletionIndex())
  await setupDatabaseEvents()

  return {
    getUser,
    getUserBy,
    getUsers,
    createUser,
    deleteUser,
    deleteUsers,
    updateUser,
    updateUsers,
  } as UserDatabase
}

export default createUserDB

export interface UserDatabase {
  getUserBy: (id: string) => Promise<User|null>
  getUser: (where?: Prisma.UserWhereInput) => Promise<User|null>
  getUsers: (where?: Prisma.UserWhereInput) => Promise<User[]|null>
  createUser: (input: Prisma.UserCreateInput) => Promise<User|never>
  deleteUser: (where: Prisma.UserWhereUniqueInput) => Promise<User|never>
  deleteUsers: (where: Prisma.UserWhereInput) => Promise<Prisma.BatchPayload|never>
  updateUser: (where: Prisma.UserWhereUniqueInput, input: Prisma.UserUpdateInput) => Promise<User|never>
  updateUsers: (where: Prisma.UserWhereInput, input: Prisma.UserUpdateInput) => Promise<Prisma.BatchPayload|never>
}
