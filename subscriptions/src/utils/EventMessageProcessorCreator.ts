import EventHandler from '../models/EventHandler'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { EventMessage, MessageEvent } from '../types/kafka/EventMessage'
import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { RedisPubSub as PubSub } from 'graphql-redis-subscriptions'
import { Entity, EntityType } from '../types/kafka/Entity'
import { SubscriptionSessionEvent, SubscriptionUserEvent } from '../types/SubscriptionPayload'
import { PubSubEvent, PubSubMessage, PubSubSessionMessage, PubSubUserMessage } from '../types/PubSubMessage'

enum DifferenceType { MORE = 'more', LESS = 'less', UNCHANGED = 'unchanged' }
type EntityDifference = { type: DifferenceType, entities: Entity[] }
const getAffectedEntities = (affectedEntities: Entity[] | undefined, type: EntityType): Entity[] =>
  affectedEntities ? affectedEntities.filter(it => it.type === type) : []

const getEntityDifference = (prevEntities: Entity[], currEntities: Entity[]): EntityDifference => {
  if (prevEntities.length === currEntities.length) {
    return {
      type: DifferenceType.UNCHANGED,
      entities: currEntities,
    }
  }

  if (prevEntities.length < currEntities.length) {
    return {
      type: DifferenceType.MORE,
      entities: currEntities.filter(it => !prevEntities.some(e => e.id === it.id)),
    }
  }

  return {
    type: DifferenceType.LESS,
    entities: prevEntities
      .filter(it => !currEntities.some(u => u.id === it.id))
      .map(it => ({ id: it.id, type: it.type })),
  }
}

export const createProcessors = (eventHandler: EventHandler,
                                 userSessionDB: UserSessionDatabase,
                                 pubSub: PubSub): void => {
  const notifyUser = async (user: string, event: SubscriptionUserEvent, entity: Entity) => {
    console.log(`Notified: user_${user}`)
    await pubSub.publish(
      `user_${user}`,
      {
        event: PubSubEvent.USER_EVENT,
        content: { event, entity }
      } as PubSubUserMessage,
    )
  }

  const notifySession = async (session: string, event: SubscriptionSessionEvent, entity: Entity) => {
    console.log(`Notified: session_${session}`)
    await pubSub.publish(
      `session_${session}`,
      {
        event: PubSubEvent.SESSION_EVENT,
        content: { event, entity }
      } as PubSubSessionMessage,
    )
  }

  const notifyUserDifferenceTo = async (sessionId: string, difference: EntityDifference) => {
    if (difference.type === DifferenceType.UNCHANGED) { return }

    for (const user of difference.entities) {
      const event = difference.type === DifferenceType.MORE
        ? SubscriptionSessionEvent.USER_ADDED
        : SubscriptionSessionEvent.USER_REMOVED
      await notifySession(sessionId, event, user)
    }
  }

  const notifyFileDifference = async (difference: EntityDifference, file: Entity) => {
    if (difference.type === DifferenceType.UNCHANGED) { return }

    for (const entity of difference.entities) {
      const event = difference.type === DifferenceType.MORE
        ? SubscriptionSessionEvent.FILE_ADDED
        : SubscriptionSessionEvent.FILE_REMOVED
      await notifySession(entity.id, event, file)
    }
  }

  const sessionCreated = async (session: Entity) => {
    const connectedUsers = getAffectedEntities(session.connectedTo, EntityType.USER)

    for (const user of connectedUsers) {
      await notifyUser(user.id, SubscriptionUserEvent.SESSION_ADDED, session)
    }

    try {
      await userSessionDB.createUserSession({ session: session.id, users: connectedUsers.map(it => it.id) })
    } catch (e) {
      console.log('Nothing deleted after session create.')
      console.log(e)
    }
  }

  const sessionUpdated = async (session: Entity, sessionBefore?: Entity) => {
    const connectedSessions = getAffectedEntities(session.connectedTo, EntityType.SESSION)
    const connectedUsers = getAffectedEntities(session.connectedTo, EntityType.USER)

    if (sessionBefore != null) {
      const usersBefore = getAffectedEntities(sessionBefore.connectedTo, EntityType.USER)
      const userDifference = getEntityDifference(usersBefore, connectedUsers)

      if (userDifference.type !== DifferenceType.UNCHANGED) {
        await notifyUserDifferenceTo(session.id, userDifference)
      } else {
        await notifySession(session.id, SubscriptionSessionEvent.SESSION_UPDATED, session)

        for (const connectedSession of connectedSessions) {
          await notifySession(connectedSession.id, SubscriptionSessionEvent.CONNECTED_SESSION_UPDATED, session)
        }

        for (const user of connectedUsers) {
          await notifyUser(user.id, SubscriptionUserEvent.SESSION_UPDATED, session)
        }
      }
    }

    try {
      await userSessionDB.updateUserSession({ session: session.id }, { users: connectedUsers.map(it => it.id) })
    } catch (e) {
      console.log('Nothing deleted after session update.')
      console.log(e)
    }
  }

  const sessionDeleted = async (session: Entity) => {
    const connectedSessions = getAffectedEntities(session.connectedTo, EntityType.SESSION)
    const connectedUsers = getAffectedEntities(session.connectedTo, EntityType.USER)

    await notifySession(session.id, SubscriptionSessionEvent.SESSION_DELETED, session)

    for (const connectedSession of connectedSessions) {
      await notifySession(connectedSession.id, SubscriptionSessionEvent.CONNECTED_SESSION_REMOVED, session)
    }

    for (const user of connectedUsers) {
      await notifyUser(user.id, SubscriptionUserEvent.SESSION_REMOVED, session)
    }

    try {
      await userSessionDB.deleteUserSession({ session: session.id })
    } catch (e) {
      console.log('Nothing deleted after session delete.')
      console.log(e)
    }
  }

  const fileCreated = async (file: Entity) => {
    const connectedSessions = getAffectedEntities(file.connectedTo, EntityType.SESSION)
    const connectedUsers = getAffectedEntities(file.connectedTo, EntityType.USER)

    for (const session of connectedSessions) {
      await notifySession(session.id, SubscriptionSessionEvent.FILE_ADDED, file)
    }

    for (const user of connectedUsers) {
      await notifyUser(user.id, SubscriptionUserEvent.FILE_ADDED, file)
    }
  }

  const fileUpdated = async (file: Entity, fileBefore?: Entity) => {
    const connectedSessions = getAffectedEntities(file.connectedTo, EntityType.SESSION)
    const sessionsBefore =  getAffectedEntities(fileBefore?.connectedTo, EntityType.SESSION)
    const connectedUsers = getAffectedEntities(file.connectedTo, EntityType.USER)
    const usersBefore = getAffectedEntities(fileBefore?.connectedTo, EntityType.USER)

    const sessionDifference = getEntityDifference(sessionsBefore, connectedSessions)
    const userDifference = getEntityDifference(usersBefore, connectedUsers)

    await notifyFileDifference(sessionDifference, file)
    await notifyFileDifference(userDifference, file)
  }

  const fileDeleted = async (file: Entity) => {
    const connectedSessions = getAffectedEntities(file.connectedTo, EntityType.SESSION)
    const connectedUsers = getAffectedEntities(file.connectedTo, EntityType.USER)

    for (const session of connectedSessions) {
      await notifySession(session.id, SubscriptionSessionEvent.FILE_REMOVED, file)
    }

    for (const user of connectedUsers) {
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
    const session = message.entity

    switch (message.event) {
      case MessageEvent.CREATED: {
        console.log('Session created')
        await sessionCreated(session)
        break
      }
      case MessageEvent.UPDATED: {
        console.log('Session updated')
        await sessionUpdated(session, message.entityBefore)
        break
      }
      case MessageEvent.DELETED: {
        console.log('Session deleted')
        await sessionDeleted(session)
        break
      }
    }
  }

  const fileEventHandler: EventMessageProcessor = async (message: EventMessage) => {
    const file = message.entity

    switch (message.event) {
      case MessageEvent.CREATED: {
        console.log('File created')
        await fileCreated(file)
        break
      }
      case MessageEvent.UPDATED: {
        console.log('File updated')
        await fileUpdated(file, message.entityBefore)
        break
      }
      case MessageEvent.DELETED: {
        console.log('File deleted')
        await fileDeleted(file)
        break
      }
    }
  }

  eventHandler.addMessageProcessorFor(KafkaTopic.USERS, userEventHandler)
  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionEventHandler)
  eventHandler.addMessageProcessorFor(KafkaTopic.FILES, fileEventHandler)
}

export default createProcessors
