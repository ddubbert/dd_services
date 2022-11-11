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
      const whereIds: Prisma.UserWhereInput[] = message.entity.connectedTo.reduce(
        (acc, entity) => (entity.type === EntityType.USER) ? [ ...acc, { id: entity.id } ] : acc,
        [] as Prisma.UserWhereInput[],
      )

      const combinedWhere: Prisma.UserWhereInput = { isPermanent: false, AND: { OR: whereIds } }
      try{
        await db.deleteUsers(combinedWhere)
        console.log(`Ad-hoc users of session "${message.entity.id}" deleted.`)
      } catch (_e) {
        console.log(`Session "${message.entity.id}" Deleted: User deletion failed.`)
      }
    }
  }

  eventHandler.addMessageProcessorFor(KafkaTopic.SESSIONS, sessionDeleted)
}

export default createProcessors
