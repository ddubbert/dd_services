import { SubscriptionPayload, SubscriptionSessionUpdate, SubscriptionUserUpdate } from './SubscriptionPayload'

export enum PubSubEvent {
  USER_EVENT = 'user_event',
  SESSION_EVENT = 'session_event',
}

export interface PubSubMessage {
  event: PubSubEvent,
  content: SubscriptionPayload,
}

export interface PubSubUserMessage extends PubSubMessage {
  event: PubSubEvent.USER_EVENT,
  content: SubscriptionUserUpdate,
}

export interface PubSubSessionMessage extends PubSubMessage {
  event: PubSubEvent.SESSION_EVENT,
  content: SubscriptionSessionUpdate,
}
