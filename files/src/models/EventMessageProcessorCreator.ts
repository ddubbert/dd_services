import EventHandler from './EventHandler'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { EventMessage, MessageEvent } from '../types/kafka/EventMessage'
import { FileDatabase } from './FileDatabase'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { Entity, EntityType } from '../types/kafka/Entity'
import { UserSessionDatabase } from './UserSessionDatabase'

const getAffectedUsers = (affectedEntities: Entity[] | undefined): string[] =>
  affectedEntities ? affectedEntities.filter(it => it.type === EntityType.USER).map(it => it.id) : []

export const createProcessors = (eventHandler: EventHandler,
                                 fileDB: FileDatabase,
                                 userSessionDB: UserSessionDatabase): void => {
  const deleteFilesWithoutReferences = async (): Promise<void> => {
    console.log('Testing for deletable files...')
    const answer = await fileDB.deleteFiles({
      AND: [
        { owner: { isSet: false } },
        { sessions: { isEmpty: true } },
      ]
    })
    console.log(answer)
  }

  const userDeleted: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED) {
      console.log('user deleted')
      const userId = message.entity.id

      try {
        const answer = await fileDB.removeOwnersFromAllFiles([ userId ])
        console.log(answer)
        await deleteFilesWithoutReferences()
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  const sessionCreated: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.CREATED) {
      console.log('session created')
      const session = message.entity.id
      const users = getAffectedUsers(message.entity.connectedTo)

      try {
        const userSessionAnswer = await userSessionDB.createUserSession({ session, users })
        console.log(userSessionAnswer)
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  const sessionUpdated: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.UPDATED) {
      console.log('session updated')
      const session = message.entity.id
      const users = getAffectedUsers(message.entity.connectedTo)

      try {
        const userSessionAnswer = await userSessionDB.updateUserSession({ session }, { users })
        console.log(userSessionAnswer)
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  const sessionDeleted: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED) {
      console.log('session deleted')
      const session = message.entity.id
      console.log(session)
      try {
        const fileAnswer = await fileDB.removeSessionsFromAllFiles([ session ])
        console.log(fileAnswer)
        await deleteFilesWithoutReferences()
        const userSessionAnswer = await userSessionDB.deleteUserSession({ session })
        console.log(userSessionAnswer)
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
