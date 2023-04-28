import EventHandler from '../models/EventHandler'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { EventMessage, MessageEvent } from '../types/kafka/EventMessage'
import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { PubSub } from 'graphql-subscriptions'
import { Entity, EntityType } from '../types/kafka/Entity'
import { SubscriptionSessionEvent, SubscriptionUserEvent } from '../types/SubscriptionPayload'
import { PubSubEvent, PubSubMessage } from '../types/PubSubMessage'

enum DifferenceType { MORE = 'more', LESS_OR_EQUAL = 'less' }
type EntityDifference = { type: DifferenceType, entities: Entity[] }
const getAffectedUsers = (affectedEntities: Entity[] | undefined): Entity[] =>
  affectedEntities ? affectedEntities.filter(it => it.type === EntityType.USER) : []

const getEntityDifference = (prevEntities: Entity[], currEntities: Entity[]): EntityDifference => {
  if (prevEntities.length < currEntities.length) {
    return {
      type: DifferenceType.MORE,
      entities: currEntities.filter(it => !prevEntities.some(e => e.id === it.id)),
    }
  }
  return {
    type: DifferenceType.LESS_OR_EQUAL,
    entities: prevEntities
      .filter(it => !currEntities.some(u => u.id === it.id))
      .map(it => ({ id: it.id, type: it.type })),
  }
}

export const createProcessors = (eventHandler: EventHandler,
                                 userSessionDB: UserSessionDatabase,
                                 pubSub: PubSub): void => {
  const notifyUser = async (user: string, event: SubscriptionUserEvent, entity: Entity) => {
    await pubSub.publish(
      user,
      {
        event: PubSubEvent.USER_EVENT,
        content: { event, entity }
      }  as PubSubMessage,
    )
  }

  const notifySession = async (session: string, event: SubscriptionSessionEvent, entity: Entity) => {
    await pubSub.publish(
      session,
      {
        event: PubSubEvent.SESSION_EVENT,
        content: { event, entity }
      }  as PubSubMessage,
    )
  }

  const notifyUserDifferenceTo = async (session: string, difference: EntityDifference) => {
    for (const user of difference.entities) {
      const event = difference.type === DifferenceType.MORE
        ? SubscriptionSessionEvent.USER_ADDED
        : SubscriptionSessionEvent.USER_REMOVED
      await notifySession(session, event, user)
    }
  }

  const notifyFileDifference = async (difference: EntityDifference, file: Entity) => {
    for (const entity of difference.entities) {
      const event = difference.type === DifferenceType.MORE
        ? SubscriptionSessionEvent.FILE_ADDED
        : SubscriptionSessionEvent.FILE_REMOVED
      await notifySession(entity.id, event, file)
    }
  }

  const sessionCreated = async (sessionId: string, users: Entity[], session: Entity) => {
    try {
      for (const user of users) {
        await notifyUser(user.id, SubscriptionUserEvent.SESSION_ADDED, session)
      }
      await userSessionDB.createUserSession({ session: sessionId, users: users.map(it => it.id) })
    } catch (e) {
      console.log('Nothing deleted.')
    }
  }

  const sessionUpdated = async (sessionId: string, users: Entity[], session: Entity, sessionBefore?: Entity) => {
    if (sessionBefore != null) {
      const usersBefore = getAffectedUsers(sessionBefore.connectedTo)

      if (usersBefore.length !== users.length) {
        const difference = getEntityDifference(usersBefore, users)

        await notifyUserDifferenceTo(sessionId, difference)
      } else {
        await notifySession(sessionId, SubscriptionSessionEvent.SESSION_UPDATED, session)

        for (const user of users) {
          await notifyUser(user.id, SubscriptionUserEvent.SESSION_UPDATED, session)
        }
      }
    }

    try {
      await userSessionDB.updateUserSession({ session: sessionId }, { users: users.map(it => it.id) })
    } catch (e) {
      console.log('Nothing deleted.')
    }
  }

  const sessionDeleted = async (sessionId: string, users: Entity[], session: Entity) => {
    await notifySession(sessionId, SubscriptionSessionEvent.SESSION_DELETED, session)
    for (const user of users) {
      await notifyUser(user.id, SubscriptionUserEvent.SESSION_REMOVED, session)
    }

    try {
      await userSessionDB.deleteUserSession({ session: sessionId })
    } catch (e) {
      console.log('Nothing deleted.')
    }
  }

  const fileCreated = async (sessions: Entity[], users: Entity[], file: Entity) => {
    for (const session of sessions) {
      await notifySession(session.id, SubscriptionSessionEvent.FILE_ADDED, file)
    }

    for (const user of users) {
      await notifyUser(user.id, SubscriptionUserEvent.FILE_ADDED, file)
    }
  }

  const fileUpdated = async (sessions: Entity[], users: Entity[], file: Entity, fileBefore?: Entity) => {
    const sessionsBefore = fileBefore?.connectedTo?.filter(it => it.type === EntityType.SESSION) ?? []
    const usersBefore = getAffectedUsers(fileBefore?.connectedTo)

    const sessionDifference = getEntityDifference(sessionsBefore, sessions)
    const userDifference = getEntityDifference(usersBefore, users)

    await notifyFileDifference(sessionDifference, file)
    await notifyFileDifference(userDifference, file)
  }

  const fileDeleted = async (sessions: Entity[], users: Entity[], file: Entity) => {
    for (const session of sessions) {
      await notifySession(session.id, SubscriptionSessionEvent.FILE_REMOVED, file)
    }

    for (const user of users) {
      await notifyUser(user.id, SubscriptionUserEvent.FILE_REMOVED, file)
    }
  }

  const userEventHandler: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED) {
      await pubSub.publish(
        message.entity.id,
        {
          event: PubSubEvent.USER_EVENT,
          content: { event: SubscriptionUserEvent.USER_DELETED, entity: message.entity }
        }  as PubSubMessage,
      )
    }
  }

  const sessionEventHandler: EventMessageProcessor = async (message: EventMessage) => {
    const session = message.entity.id
    const users = getAffectedUsers(message.entity.connectedTo)

    switch (message.event) {
      case MessageEvent.CREATED: {
        await sessionCreated(session, users, message.entity)
        break
      }
      case MessageEvent.UPDATED: {
        await sessionUpdated(session, users, message.entity, message.entityBefore)
        break
      }
      case MessageEvent.DELETED: {
        await sessionDeleted(session, users, message.entity)
        break
      }
    }
  }

  const fileEventHandler: EventMessageProcessor = async (message: EventMessage) => {
    const sessions = message.entity.connectedTo?.filter(it => it.type === EntityType.SESSION) ?? []
    const users = getAffectedUsers(message.entity.connectedTo)

    switch (message.event) {
      case MessageEvent.CREATED: {
        await fileCreated(sessions, users, message.entity)
        break
      }
      case MessageEvent.UPDATED: {
        await fileUpdated(sessions, users, message.entity, message.entityBefore)
        break
      }
      case MessageEvent.DELETED: {
        await fileDeleted(sessions, users, message.entity)
        break
      }
    }
  }

  eventHandler.addMessageProcessorFor(KafkaTopic.USERS, userEventHandler)
  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionEventHandler)
  eventHandler.addMessageProcessorFor(KafkaTopic.FILES, fileEventHandler)
}

export default createProcessors
