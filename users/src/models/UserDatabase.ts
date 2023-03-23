import { Prisma, PrismaClient, User } from '@prisma/client'
import { ChangeStream, MongoClient } from 'mongodb'
import EventHandler from './EventHandler'
import { MessageEvent } from '../types/kafka/EventMessage'
import { EntityType } from '../types/kafka/Entity'
import { KafkaTopic } from '../types/kafka/KafkaTopic'

const DB_NAME = process.env.DATABASE_NAME ?? 'dd_services_users'
const COLLECTION_NAME = 'dd_users'

const getUserRepresentationFrom = (dbUser: any): Partial<User> => ({
  id: dbUser._id,
  nickname: dbUser.nickname,
  isPermanent: dbUser.isPermanent,
  createdAt: dbUser.createdAt,
  updatedAt: dbUser.updatedAt,
})

export const createUserDB = async (events: EventHandler): Promise<UserDatabase> => {
  const prisma = new PrismaClient()
  let mongo: MongoClient
  let usersChangeStream: ChangeStream

  const setupDatabaseEvents = async (): Promise<void> => {
    const dbUrl = process.env.DB_URL
    if (!dbUrl) {throw new Error('No DB_URL provided in environment.')}

    mongo = new MongoClient(dbUrl)

    const database = mongo.db(DB_NAME)
    const collection = database.collection(COLLECTION_NAME)
    usersChangeStream = collection.watch([], {
      fullDocumentBeforeChange: 'required',
      fullDocument: 'updateLookup',
    })

    usersChangeStream.on('change', async next => {
      switch (next.operationType) {
      case 'insert': {
        console.log('DB-Event: user created')
        await events.send(KafkaTopic.USERS, [ {
          event: MessageEvent.CREATED,
          entity: {
            type: EntityType.USER,
            id: next.documentKey._id.toString(),
          },
          message: JSON.stringify(getUserRepresentationFrom(next.fullDocument)),
        } ])
        break
      }
      case 'update': {
        console.log('DB-Event: user updated')
        const doc = next.fullDocument
        let message: string | undefined

        if (doc) { message = JSON.stringify(getUserRepresentationFrom(doc)) }

        await events.send(KafkaTopic.USERS, [ {
          event: MessageEvent.UPDATED,
          entity: {
            type: EntityType.USER,
            id: next.documentKey._id.toString(),
          },
          message,
        } ])
        break
      }
      case 'delete': {
        console.log('DB-Event: user deleted')
        const doc = next.fullDocumentBeforeChange
        let message: string | undefined

        if (doc) { message = JSON.stringify(getUserRepresentationFrom(doc)) }
        await events.send(KafkaTopic.USERS, [ {
          event: MessageEvent.DELETED,
          entity: {
            type: EntityType.USER,
            id: next.documentKey._id.toString(),
          },
          message,
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
      createIndexes: COLLECTION_NAME,
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

  const updateUser = async (where: Prisma.UserWhereUniqueInput, input: Prisma.UserUpdateInput): Promise<User|never> =>
    (await prisma.user.update({ where, data: input }))

  const updateUsers =
    async (where: Prisma.UserWhereInput, input: Prisma.UserUpdateInput): Promise<Prisma.BatchPayload|never> =>
      (await prisma.user.updateMany({ where, data: input }))

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
