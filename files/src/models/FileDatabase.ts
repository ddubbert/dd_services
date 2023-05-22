import { Prisma, PrismaClient, File } from '@prisma/client'
import EventHandler from './EventHandler'
import { ChangeStream, Document, MongoClient } from 'mongodb'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { MessageEvent } from '../types/kafka/EventMessage'
import { Entity, EntityType } from '../types/kafka/Entity'
import { DBFunction, DBFunctionPayload, RawUpdatePayload, verifyRawUpdatePayload } from '../types/DBFunction'
import { InternalServerError } from '../types/Errors'
import { UploadHandler } from './UploadHandler'

const DB_NAME = process.env.DATABASE_NAME ?? 'dd_services_files'
const COLLECTION_NAME = 'dd_files'

const getAffectedEntities = (file: File): Entity[] => {
  const affectedOwner: Entity[] = file.owner ? [ { type: EntityType.USER, id: file.owner } ] : []
  const affectedSessions: Entity[] = file.sessions.map((id): Entity => ({ type: EntityType.SESSION, id }))
  return [ ...affectedOwner, ...affectedSessions ]
}

const getEntityFrom = (doc: Document, id: string): Entity => {
  const entity: Entity = { type: EntityType.FILE, id }

  doc.id = doc._id
  const affectedEntities = getAffectedEntities(doc as File)
  if (affectedEntities.length > 0) { entity.connectedTo = affectedEntities }

  return entity
}

export const createFileDB = async (events: EventHandler, uploadHandler: UploadHandler): Promise<FileDatabase> => {
  const prisma = new PrismaClient()
  let mongo: MongoClient
  let filesChangeStream: ChangeStream

  const setupDatabaseEvents = async (): Promise<void> => {
    const dbUrl = process.env.DB_URL
    if (!dbUrl) { throw new InternalServerError('No DB_URL provided in environment.') }

    mongo = new MongoClient(dbUrl)

    const database = mongo.db(DB_NAME)
    const collection = database.collection(COLLECTION_NAME)
    filesChangeStream = collection.watch([], {
      fullDocumentBeforeChange: 'required',
      fullDocument: 'updateLookup',
    })

    filesChangeStream.on('change', async next => {
      switch (next.operationType) {
      case 'insert': {
        const doc = next.fullDocument

        await events.send(KafkaTopic.FILES, [ {
          event: MessageEvent.CREATED,
          entity: getEntityFrom(doc, next.documentKey._id.toString()),
        } ])
        break
      }
      case 'update': {
        const doc = next.fullDocument
        if (doc == null) { return }

        const id = next.documentKey._id.toString()
        const fileHasOwnerOrSessions = !!doc.owner || doc.sessions.length > 0

        if (!fileHasOwnerOrSessions) {
          try {
            await deleteFile({ id })
          } catch {
            // TODO
            console.log(`File ${id} could not be deleted.`)
          }
        } else {
          const docBefore = next.fullDocumentBeforeChange

          await events.send(KafkaTopic.FILES, [ {
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

        try {
          await uploadHandler.deleteFiles([ doc.localId ])
        } catch (e) {
          console.log('Could not delete files') // TODO: Backup plan
        }

        const id = next.documentKey._id.toString()

        await events.send(KafkaTopic.FILES, [ {
          event: MessageEvent.DELETED,
          entity: getEntityFrom(doc, id),
        } ])
        break
      }
      default: {
        break
      }
      }
    })
  }

  const getFileBy = async (id: string | null | undefined): Promise<File | null> =>
    id ? await createGetTransaction({ id })() : null

  const getFile = async (where: Prisma.FileWhereInput): Promise<File | null> =>
    await createGetTransaction(where)()

  const getFiles = async (where: Prisma.FileWhereInput = {}): Promise<File[]> =>
    await createGetManyTransaction(where)()

  const createFile = async (data: Prisma.FileCreateInput): Promise<File | never> =>
    (await prisma.file.create({ data }))

  const createFiles = async (data: Prisma.FileCreateManyInput[]): Promise<Prisma.BatchPayload | never> =>
    (await prisma.file.createMany({ data }))

  const deleteFile = async (where: Prisma.FileWhereUniqueInput): Promise<File|never> =>
    (await prisma.file.delete({ where }))

  const deleteFiles = async (where: Prisma.FileWhereInput): Promise<Prisma.BatchPayload|never> =>
    (await prisma.file.deleteMany({ where }))

  const updateFile = async (where: Prisma.FileWhereUniqueInput, input: Prisma.FileUpdateInput): Promise<File|never> =>
    await createUpdateTransaction(where, input)()

  const updateFiles =
    async (where: Prisma.FileWhereInput, input: Prisma.FileUpdateInput): Promise<Prisma.BatchPayload|never> =>
      await createUpdateManyTransaction(where, input)()

  const createGetTransaction =
    (where: Prisma.FileWhereInput): DBFunction<File | null> =>
      () => prisma.file.findFirst({ where })

  const createGetManyTransaction =
    (where: Prisma.FileWhereInput): DBFunction<File[]> =>
      () => prisma.file.findMany({ where })

  const createUpdateTransaction =
    (where: Prisma.FileWhereUniqueInput, input: Prisma.FileUpdateInput): DBFunction<File|never> => () =>
      (prisma.file.update({ where, data: input }))

  const createUpdateManyTransaction =
    (where: Prisma.FileWhereInput, input: Prisma.FileUpdateInput): DBFunction<Prisma.BatchPayload|never> => () =>
      (prisma.file.updateMany({ where, data: input }))

  const removeOwnersFromAllFiles = async (owners: string[]): Promise<Prisma.BatchPayload|never> =>
    updateFiles({ owner: { in: owners } }, { owner: null })

  const removeSessionsFromAllFiles = async (sessions: string[]): Promise<RawUpdatePayload|never> => {
    const updates: Prisma.InputJsonObject[] = [ {
      q: { sessions: { $in: [ sessions ] } },
      u: {
        $pullAll: { sessions },
        $currentDate: { updatedAt: true },
      },
      multi: true,
    } ]

    const payload = await (createRawCommand({ update: COLLECTION_NAME, updates }))()
    verifyRawUpdatePayload(payload)
    return payload
  }

  const createRawCommand = (command: Prisma.InputJsonObject): DBFunction<Prisma.JsonObject|never> =>
    () => prisma.$runCommandRaw(command)

  const runTransactions = async (transactions: DBFunction<DBFunctionPayload>[]): Promise<DBFunctionPayload[]> =>
    await prisma.$transaction(transactions.map(it => it()))

  await setupDatabaseEvents()

  return {
    getFile,
    getFileBy,
    getFiles,
    createFile,
    createFiles,
    deleteFile,
    deleteFiles,
    updateFile,
    updateFiles,
    runTransactions,
    createGetTransaction,
    createGetManyTransaction,
    createUpdateTransaction,
    createUpdateManyTransaction,
    removeOwnersFromAllFiles,
    removeSessionsFromAllFiles,
  } as FileDatabase
}

export default createFileDB

export interface FileDatabase {
  getFileBy: (id: string | null | undefined) => Promise<File|null>
  getFile: (where?: Prisma.FileWhereInput) => Promise<File|null>
  getFiles: (where?: Prisma.FileWhereInput) => Promise<File[]>
  createFile: (input: Prisma.FileCreateInput) => Promise<File|never>
  createFiles: (data: Prisma.FileCreateManyInput[]) => Promise<Prisma.BatchPayload | never>
  deleteFile: (where: Prisma.FileWhereUniqueInput) => Promise<File|never>
  deleteFiles: (where: Prisma.FileWhereInput) => Promise<Prisma.BatchPayload|never>
  updateFile: (where: Prisma.FileWhereUniqueInput, input: Prisma.FileUpdateInput) => Promise<File|never>
  updateFiles: (where: Prisma.FileWhereInput, input: Prisma.FileUpdateInput) => Promise<Prisma.BatchPayload|never>
  removeOwnersFromAllFiles: (users: string[]) => Promise<Prisma.BatchPayload|never>
  runTransactions: (transactions: DBFunction<DBFunctionPayload>[]) => Promise<DBFunctionPayload[]>
  createGetTransaction: (where: Prisma.FileWhereInput) => DBFunction<File | null>
  createGetManyTransaction: (where: Prisma.FileWhereInput) => DBFunction<File[] | null>
  createUpdateTransaction: (where: Prisma.FileWhereUniqueInput, input: Prisma.FileUpdateInput) => DBFunction<File>
  createUpdateManyTransaction:
  (where: Prisma.FileWhereInput, input: Prisma.FileUpdateInput) => DBFunction<Prisma.BatchPayload>
  removeSessionsFromAllFiles: (sessions: string[]) => Promise<RawUpdatePayload|never>
}
