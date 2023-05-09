import { Entity } from './kafka/Entity'

export type SubscriptionEntity = Entity

export interface SubscriptionUserUpdate {
  event: SubscriptionUserEvent
  entity: SubscriptionEntity
}

export enum SubscriptionUserEvent {
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  SESSION_ADDED = 'session_added',
  SESSION_UPDATED = 'session_updated',
  SESSION_REMOVED = 'session_removed',
  FILE_ADDED = 'file_added',
  FILE_REMOVED = 'file_removed'
}

export interface SubscriptionSessionUpdate {
  event: SubscriptionSessionEvent
  entity: SubscriptionEntity
}

export enum SubscriptionSessionEvent {
  SESSION_UPDATED = 'session_updated',
  SESSION_DELETED = 'session_deleted',
  USER_ADDED = 'user_added',
  USER_REMOVED = 'user_removed',
  CONNECTED_SESSION_UPDATED = 'connected_session_updated',
  CONNECTED_SESSION_REMOVED = 'connected_session_removed',
  FILE_ADDED = 'file_added',
  FILE_REMOVED = 'file_removed'
}

export type SubscriptionPayload = SubscriptionSessionUpdate | SubscriptionUserUpdate
