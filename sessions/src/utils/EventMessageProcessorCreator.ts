import EventHandler from '../models/EventHandler'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { EventMessage, MessageEvent } from '../types/kafka/EventMessage'
import { SessionDatabase } from '../models/SessionDatabase'
import { KafkaTopic } from '../types/kafka/KafkaTopic'

export const createProcessors = (eventHandler: EventHandler, db: SessionDatabase): void => {
  const userDeleted: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED) {
      console.log('user deleted')
      const userId = message.entity.id

      try{
        await db.removeUsersFromAllSessions([ userId ])
      } catch (e) {
        console.log('Nothing deleted.')
      }
    }
  }

  eventHandler.addMessageProcessorFor(KafkaTopic.USERS, userDeleted)
}

export default createProcessors
