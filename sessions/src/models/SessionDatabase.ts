import { Prisma, PrismaClient, Session } from '@prisma/client'
import EventHandler from './EventHandler'
import { ChangeStream, Document, MongoClient } from 'mongodb'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { MessageEvent } from '../types/kafka/EventMessage'
import { Entity, EntityType } from '../types/kafka/Entity'
import { DBFunction, DBFunctionPayload, RawUpdatePayload, verifyRawUpdatePayload } from '../types/DBFunction'
import { getOtherRole, UserRole } from '../types/UserRole'
import { InternalServerError } from '../types/Errors'

const DB_NAME = process.env.DATABASE_NAME ?? 'dd_services_sessions'
const COLLECTION_NAME = 'dd_sessions'

const getAffectedEntities = (session: Session): Entity[] => {
  const parentSession: Entity[] = session.parentSession
    ? [ { type: EntityType.SESSION, id: session.parentSession } ]
    : []
  const affectedOwners: Entity[] = session.owners.map(id => ({ type: EntityType.USER, id }))
  const affectedParticipants: Entity[] = session.participants.map((id): Entity => ({ type: EntityType.USER, id }))
  return [ ...parentSession, ...affectedOwners, ...affectedParticipants ]
}

const getEntityFrom = (doc: Document, id: string): Entity => {
  const entity: Entity = { type: EntityType.FILE, id }

  doc.id = doc._id
  const affectedEntities = getAffectedEntities(doc as Session)
  if (affectedEntities.length > 0) { entity.connectedTo = affectedEntities }

  return entity
}

export const createSessionDB = async (events: EventHandler): Promise<SessionDatabase> => {
  const prisma = new PrismaClient()
  let mongo: MongoClient
  let sessionsChangeStream: ChangeStream

  const setupDatabaseEvents = async (): Promise<void> => {
    const dbUrl = process.env.DB_URL
    if (!dbUrl) { throw new InternalServerError('No DB_URL provided in environment.') }

    mongo = new MongoClient(dbUrl)

    const database = mongo.db(DB_NAME)
    const collection = database.collection(COLLECTION_NAME)
    sessionsChangeStream = collection.watch([], {
      fullDocumentBeforeChange: 'required',
      fullDocument: 'updateLookup',
    })

    sessionsChangeStream.on('change', async next => {
      switch (next.operationType) {
      case 'insert': {
        const doc = next.fullDocument

        await events.send(KafkaTopic.SESSIONS, [ {
          event: MessageEvent.CREATED,
          entity: getEntityFrom(doc, next.documentKey._id.toString()),
        } ])
        break
      }
      case 'update': {
        const doc = next.fullDocument
        if (doc == null) { return }
        const id = next.documentKey._id.toString()

        const sessionHasUser = (doc.owners.length + doc.participants.length) > 0

        if (!sessionHasUser) { await deleteSession({ id }) }
        else {
          const docBefore = next.fullDocumentBeforeChange
          await events.send(KafkaTopic.SESSIONS, [ {
            event: MessageEvent.UPDATED,
            entity: getEntityFrom(doc, id),
            entityBefore: (docBefore != null) ? getEntityFrom(docBefore, id) : undefined,
          } ])
        }

        break
      }
      case 'delete': {
        const doc = next.fullDocumentBeforeChange
        if (doc == null) { return }
        doc.id = doc._id

        await deleteChildSessionsFor(doc as Session)

        await events.send(KafkaTopic.SESSIONS, [ {
          event: MessageEvent.DELETED,
          entity: getEntityFrom(doc, next.documentKey._id.toString()),
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
      createIndexes: COLLECTION_NAME,
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
    (where: Prisma.SessionWhereUniqueInput, input: Prisma.SessionUpdateInput): DBFunction<Session|never> => () =>
      (prisma.session.update({ where, data: input }))

  const createUpdateManyTransaction =
    (where: Prisma.SessionWhereInput, input: Prisma.SessionUpdateInput): DBFunction<Prisma.BatchPayload|never> => () =>
      (prisma.session.updateMany({ where, data: input }))

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
    },
    {
      q: { parentSession: { $eq: session.id } },
      u: {
        $pullAll: { participants: users, owners: users },
        $currentDate: { updatedAt: true },
      },
    } ]

    const payload = await (createRawCommand({ update: COLLECTION_NAME, updates }))()
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
      multi: true,
    } ]

    const payload = await (createRawCommand({ update: COLLECTION_NAME, updates }))()
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

    if (session.parentSession) {
      newUsers.forEach(newUser => updates.push({
        q: { _id: { $eq: { $oid: session.parentSession } }, owners: { $nin: [ newUser ] } },
        u: { $addToSet: { participants: newUser }, $currentDate: { updatedAt: true } },
      }))
    }

    return createRawCommand({ update: COLLECTION_NAME, updates })
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
