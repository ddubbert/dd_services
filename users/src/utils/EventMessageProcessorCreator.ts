import EventHandler from '../models/EventHandler'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { EventMessage, MessageEvent } from '../types/kafka/EventMessage'
import { UserDatabase } from '../models/UserDatabase'
import { KafkaTopic } from '../types/kafka/KafkaTopic'
import { EntityType } from '../types/kafka/Entity'
import { Prisma } from '@prisma/client'

export const createProcessors = (eventHandler: EventHandler, db: UserDatabase): void => {
  const sessionDeleted: EventMessageProcessor = async (message: EventMessage) => {
    if (message.event === MessageEvent.DELETED
      && message.entity.connectedTo?.length
      && !message.entity.connectedTo.some(it => it.type === EntityType.SESSION)
    ) {
      const whereIds: string[] = message.entity.connectedTo.reduce(
        (acc, entity) => (entity.type === EntityType.USER) ? [ ...acc, entity.id ] : acc,
        [] as string[],
      )

      const combinedWhere: Prisma.UserWhereInput = { AND: [ { isPermanent: false }, { id: { in: whereIds } } ] }
      try{
        await db.deleteUsers(combinedWhere)
        console.log(`Ad-hoc users of session "${message.entity.id}" deleted.`)
      } catch (_e) {
        console.log(`Session "${message.entity.id}" Deleted: User deletion failed.`)
      }
    }
  }

  // const allEvents: EventMessageProcessor = async (message: EventMessage) => {
  //   console.log('Event received:')
  //   console.log(message.message)
  //   console.log(message.event)
  //   console.log(message.entity)
  //   console.log('')
  // }

  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionDeleted)
  // TODO:
  // Maybe send emails on events?
}

export default createProcessors
