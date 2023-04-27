import EventHandler from '../models/EventHandler'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { EventMessage, MessageEvent } from '../types/kafka/EventMessage'
import { FileDatabase } from '../models/FileDatabase'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { Entity, EntityType } from '../types/kafka/Entity'
import { UserSessionDatabase } from '../models/UserSessionDatabase'

const getAffectedUsers = (affectedEntities: Entity[] | undefined): string[] =>
  affectedEntities ? affectedEntities.filter(it => it.type === EntityType.USER).map(it => it.id) : []

export const createProcessors = (eventHandler: EventHandler,
                                 fileDB: FileDatabase,
                                 userSessionDB: UserSessionDatabase): void => {
  const deleteFilesWithoutReferences = async (): Promise<void> => {
    await fileDB.deleteFiles({
      AND: [
        { owner: { isSet: false } },
        { sessions: { isEmpty: true } },
      ]
    })
  }

  const userDeleted: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED) {
      const userId = message.entity.id

      try {
        await fileDB.removeOwnersFromAllFiles([ userId ])
        await deleteFilesWithoutReferences()
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  const sessionCreated: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.CREATED) {
      const session = message.entity.id
      const users = getAffectedUsers(message.entity.connectedTo)

      try {
        await userSessionDB.createUserSession({ session, users })
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  const sessionUpdated: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.UPDATED) {
      const session = message.entity.id
      const users = getAffectedUsers(message.entity.connectedTo)

      try {
        await userSessionDB.updateUserSession({ session }, { users })
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  const sessionDeleted: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED) {
      const session = message.entity.id

      try {
        await fileDB.removeSessionsFromAllFiles([ session ])
        await deleteFilesWithoutReferences()
        await userSessionDB.deleteUserSession({ session })
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  eventHandler.addMessageProcessorFor(KafkaTopic.USERS, userDeleted)
  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionCreated)
  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionUpdated)
  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionDeleted)
}

export default createProcessors
