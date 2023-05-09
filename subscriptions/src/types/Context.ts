import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { ExecutionContext } from 'graphql/execution/execute'
import { Authenticator } from '../models/Authenticator'
import EventHandler from '../models/EventHandler'
import { AccessTokenContent } from './AccessTokenContent'
import { Request } from 'express'
import { RedisPubSub as PubSub } from 'graphql-redis-subscriptions'

export interface CustomContextData {
  currentUser: AccessTokenContent
  db: UserSessionDatabase
  pubSub: PubSub
}
export interface Context extends ExecutionContext, CustomContextData {}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyContext(data: unknown): asserts data is Context {
  if (!(data instanceof Object)) {
    throw new Error('Decoded context error. Context must be an object')
  }
  if (!('currentUser' in data)) {
    throw new Error('Decoded context error. Missing required field "currentUser"')
  }
  if (!('db' in data)) {
    throw new Error('Decoded context error. Missing required field "db"')
  }
}
