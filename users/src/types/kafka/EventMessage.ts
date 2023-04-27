import { Entity, verifyEntity } from './Entity'

export interface EventMessage {
  event: MessageEvent
  entity: Entity
  entityBefore?: Entity
  message?: string
}

export enum MessageEvent {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyEventMessage(data: unknown): asserts data is EventMessage {
  if (!(data instanceof Object)) {
    throw new Error('Decoded message error. Message must be an object')
  }
  if (!('event' in data)) {
    throw new Error('Decoded message error. Missing required field "event"')
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!Object.values(MessageEvent).includes(data.event)) {
    throw new Error('Decoded message error. Field "event" needs to be of type MessageEvent')
  }
  if (!('entity' in data)) {
    throw new Error('Decoded message error. Missing required field "entity"')
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  verifyEntity(data.entity)
}
