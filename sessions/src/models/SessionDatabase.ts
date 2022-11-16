import moment from 'moment'
import { Prisma, PrismaClient, Session } from '@prisma/client'
import EventHandler from './EventHandler'
import { ChangeStream, MongoClient } from 'mongodb'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { MessageEvent } from '../types/kafka/EventMessage'
import { Entity, EntityType } from '../types/kafka/Entity'
import { DBFunction, DBFunctionPayload, RawUpdatePayload, verifyRawUpdatePayload } from '../types/DBFunction'
import { getOtherRole, UserRole } from '../types/UserRole'
import { InternalServerError } from '../types/Errors'

const getAffectedEntities = (session: Session): Entity[] => {
  const parentSession: Entity[] = session.parentSession
    ? [ { type: EntityType.SESSION, id: session.parentSession } ]
    : []
  const affectedOwners: Entity[] = session.owners.map(id => ({ type: EntityType.USER, id }))
  const affectedParticipants: Entity[] = session.participants.map((id): Entity => ({ type: EntityType.USER, id }))
  return [ ...parentSession, ...affectedOwners, ...affectedParticipants ]
}

export const createSessionDB = async (events: EventHandler): Promise<SessionDatabase> => {
  const prisma = new PrismaClient()
  let mongo: MongoClient
  let sessionsChangeStream: ChangeStream

  const setupDatabaseEvents = async (): Promise<void> => {
    const dbUrl = process.env.DB_URL
    if (!dbUrl) { throw new InternalServerError('No DB_URL provided in environment.') }

    mongo = new MongoClient(dbUrl)

    const dbName = process.env.DB_DATABASE
    if (!dbName) { throw new InternalServerError('No DB_DATABASE provided in environment.') }

    const database = mongo.db(dbName)
    const collection = database.collection('sessions')
    sessionsChangeStream = collection.watch([], {
      fullDocumentBeforeChange: 'required',
      fullDocument: 'updateLookup',
    })

    sessionsChangeStream.on('change', async next => {
      switch (next.operationType) {
      case 'insert': {
        const entity: Entity = { type: EntityType.SESSION, id: next.documentKey._id.toString() }
        const doc = next.fullDocument
        doc.id = doc._id

        const affectedEntities = getAffectedEntities(doc as Session)
        if (affectedEntities.length > 0) { entity.connectedTo = affectedEntities }

        await events.send(KafkaTopic.SESSIONS, [ {
          event: MessageEvent.CREATED,
          entity,
        } ])
        break
      }
      case 'update': {
        const id = next.documentKey._id.toString()
        const entity: Entity = { type: EntityType.SESSION, id }
        const doc = next.fullDocument
        let sessionHasUser = true

        if (doc) {
          doc.id = doc._id
          const affectedEntities = getAffectedEntities(doc as Session)
          if (affectedEntities.length > 0) { entity.connectedTo = affectedEntities }
          sessionHasUser = (doc.owners.length + doc.participants.length) > 0
        }

        await events.send(KafkaTopic.SESSIONS, [ {
          event: MessageEvent.UPDATED,
          entity,
        } ])

        if (!sessionHasUser) { await deleteSession({ id }) }
        break
      }
      case 'delete': {
        const entity: Entity = { type: EntityType.SESSION, id: next.documentKey._id.toString() }
        const doc = next.fullDocumentBeforeChange

        if (doc) {
          doc.id = doc._id
          await deleteChildSessionsFor(doc as Session)
          const affectedEntities = getAffectedEntities(doc as Session)
          if (affectedEntities.length > 0) { entity.connectedTo = affectedEntities }
        }

        await events.send(KafkaTopic.SESSIONS, [ {
          event: MessageEvent.DELETED,
          entity,
        } ])
        break
      }
      default: {
        break
      }
      }
    })
  }

  const createDateDeletionIndex = async (): Promise<Prisma.JsonObject> =>
    await prisma.$runCommandRaw({
      createIndexes: 'sessions',
      indexes: [
        {
          key: { deletedAt: 1 },
          name: 'DateExpirationIndex',
          expireAfterSeconds: 0,
        },
      ],
    })

  const deleteChildSessionsFor = async (session: Session): Promise<void> => {
    try {
      await deleteSessions({
        AND: [
          { parentSession: { not: null } },
          { parentSession: { not: undefined } },
          { parentSession: { not: '' } },
          { parentSession: session.id },
        ],
      })
    } catch (e) {
      console.error('No child sessions found and deleted.')
    }
  }

  const getSessionBy = async (id: string | null | undefined): Promise<Session | null> =>
    id ? await createGetTransaction({ id })() : null

  const getSession = async (where: Prisma.SessionWhereInput): Promise<Session | null> =>
    await createGetTransaction(where)()

  const getSessions = async (where: Prisma.SessionWhereInput = {}): Promise<Session[] | null> =>
    await createGetManyTransaction(where)()

  const createSession = async (data: Prisma.SessionCreateInput): Promise<Session | never> =>
    (await prisma.session.create({ data }))

  const deleteSession = async (where: Prisma.SessionWhereUniqueInput): Promise<Session|never> =>
    (await prisma.session.delete({ where }))

  const deleteSessions = async (where: Prisma.SessionWhereInput): Promise<Prisma.BatchPayload|never> =>
    (await prisma.session.deleteMany({ where }))

  const updateSession = async (where: Prisma.SessionWhereUniqueInput, input: Prisma.SessionUpdateInput): Promise<Session|never> =>
    await createUpdateTransaction(where, input)()

  const updateSessions =
    async (where: Prisma.SessionWhereInput, input: Prisma.SessionUpdateInput): Promise<Prisma.BatchPayload|never> =>
      await createUpdateManyTransaction(where, input)()

  const createGetTransaction =
    (where: Prisma.SessionWhereInput): DBFunction<Session | null> =>
      () => prisma.session.findFirst({ where })

  const createGetManyTransaction =
    (where: Prisma.SessionWhereInput): DBFunction<Session[] | null> =>
      () => prisma.session.findMany({ where })

  const createUpdateTransaction =
    (where: Prisma.SessionWhereUniqueInput, input: Prisma.SessionUpdateInput): DBFunction<Session|never> => () => {
      const data = { ...input, updatedAt: moment().toISOString() }

      return prisma.session.update({
        where,
        data,
      })
    }

  const createUpdateManyTransaction =
    (where: Prisma.SessionWhereInput, input: Prisma.SessionUpdateInput): DBFunction<Prisma.BatchPayload|never> => () => {
      const data = { ...input, updatedAt: moment().toISOString() }

      return prisma.session.updateMany({
        where,
        data,
      })
    }

  const addUsersAsParticipants = async (session: Session, newUsers: string[]): Promise<RawUpdatePayload|never> => {
    const payload = await (createAddUsersAsTransaction(session, newUsers, 'participants'))()
    verifyRawUpdatePayload(payload)
    return payload
  }

  const addUsersAsOwners = async (session: Session, newUsers: string[]): Promise<RawUpdatePayload|never> => {
    const payload = await (createAddUsersAsTransaction(session, newUsers, 'owners'))()
    verifyRawUpdatePayload(payload)
    return payload
  }

  const removeUsersFromSession = async (session: Session, users: string[]): Promise<RawUpdatePayload|never> => {
    const updates: Prisma.InputJsonObject[] = [ {
      q: { _id: { $eq: { $oid: session.id } } },
      u: {
        $pullAll: { participants: users, owners: users },
        $currentDate: { updatedAt: true },
      },
    } ]

    const payload = await (createRawCommand({ update: 'sessions', updates }))()
    verifyRawUpdatePayload(payload)
    return payload
  }

  const removeUsersFromAllSessions = async (users: string[]): Promise<RawUpdatePayload|never> => {
    const updates: Prisma.InputJsonObject[] = [ {
      q: { $or: [ { owners: { $in: [ users ] } }, { participants: { $in: [ users ] } } ] },
      u: {
        $pullAll: { participants: users , owners: users },
        $currentDate: { updatedAt: true },
      },
    } ]

    const payload = await (createRawCommand({ update: 'sessions', updates }))()
    verifyRawUpdatePayload(payload)
    return payload
  }

  const createAddUsersAsTransaction = (session: Session, newUsers: string[], role: UserRole): DBFunction<Prisma.JsonObject|never> => {
    const updates: Prisma.InputJsonObject[] = [ {
      q: { _id: { $eq: { $oid: session.id } } },
      u: {
        $addToSet: { [role]: { $each: newUsers } },
        $pullAll: { [getOtherRole(role)]: newUsers },
        $currentDate: { updatedAt: true },
      },
    } ]

    if (session.parentSession) { newUsers.forEach(newUser => updates.push({
      q: { _id: { $eq: { $oid: session.parentSession } }, owners: { $nin: [ newUser ] } },
      u: { $addToSet: { participants: newUser }, $currentDate: { updatedAt: true } },
    }))
    }

    return createRawCommand({ update: 'sessions', updates })
  }

  const createRawCommand = (command: Prisma.InputJsonObject): DBFunction<Prisma.JsonObject|never> =>
    () => prisma.$runCommandRaw(command)

  const runTransactions = async (transactions: DBFunction<DBFunctionPayload>[]): Promise<DBFunctionPayload[]> =>
    await prisma.$transaction(transactions.map(it => it()))

  console.log(await createDateDeletionIndex())
  await setupDatabaseEvents()

  return {
    getSession,
    getSessionBy,
    getSessions,
    createSession,
    deleteSession,
    deleteSessions,
    updateSession,
    updateSessions,
    runTransactions,
    createGetTransaction,
    createGetManyTransaction,
    createUpdateTransaction,
    createUpdateManyTransaction,
    createAddUsersAsTransaction,
    addUsersAsParticipants,
    addUsersAsOwners,
    removeUsersFromAllSessions,
    removeUsersFromSession,
  } as SessionDatabase
}

export default createSessionDB

export interface SessionDatabase {
  getSessionBy: (id: string | null | undefined) => Promise<Session|null>
  getSession: (where?: Prisma.SessionWhereInput) => Promise<Session|null>
  getSessions: (where?: Prisma.SessionWhereInput) => Promise<Session[]|null>
  createSession: (input: Prisma.SessionCreateInput) => Promise<Session|never>
  deleteSession: (where: Prisma.SessionWhereUniqueInput) => Promise<Session|never>
  deleteSessions: (where: Prisma.SessionWhereInput) => Promise<Prisma.BatchPayload|never>
  updateSession: (where: Prisma.SessionWhereUniqueInput, input: Prisma.SessionUpdateInput) => Promise<Session|never>
  updateSessions: (where: Prisma.SessionWhereInput, input: Prisma.SessionUpdateInput) =>
  Promise<Prisma.BatchPayload|never>
  addUsersAsParticipants: (session: Session, newUsers: string[]) => Promise<RawUpdatePayload|never>
  addUsersAsOwners: (session: Session, newUsers: string[]) => Promise<RawUpdatePayload|never>
  removeUsersFromAllSessions: (users: string[]) => Promise<RawUpdatePayload|never>
  removeUsersFromSession: (session: Session, users: string[]) => Promise<RawUpdatePayload|never>
  runTransactions: (transactions: DBFunction<DBFunctionPayload>[]) => Promise<DBFunctionPayload[]>
  createGetTransaction: (where: Prisma.SessionWhereInput) => DBFunction<Session | null>
  createGetManyTransaction: (where: Prisma.SessionWhereInput) => DBFunction<Session[] | null>
  createUpdateTransaction:
  (where: Prisma.SessionWhereUniqueInput, input: Prisma.SessionUpdateInput) => DBFunction<Session>
  createUpdateManyTransaction:
  (where: Prisma.SessionWhereInput, input: Prisma.SessionUpdateInput) => DBFunction<Prisma.BatchPayload>
  createAddUsersAsTransaction: (session: Session, newUsers: string[], role: UserRole) =>
  DBFunction<Prisma.JsonObject|never>
}
