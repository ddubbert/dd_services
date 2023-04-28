import { SubscriptionSessionUpdate, SubscriptionUserUpdate } from './SubscriptionPayload'

export enum PubSubEvent {
  USER_EVENT = 'user_event',
  SESSION_EVENT = 'session_event',
}

export type PubSubContent = SubscriptionSessionUpdate | SubscriptionUserUpdate

export interface PubSubUserMessage {
  event: PubSubEvent.USER_EVENT,
  content: SubscriptionUserUpdate,
}

export interface PubSubSessionMessage {
  event: PubSubEvent.SESSION_EVENT,
  content: SubscriptionSessionUpdate,
}

export type PubSubMessage = PubSubUserMessage | PubSubSessionMessage
