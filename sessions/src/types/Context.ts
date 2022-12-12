import { SessionDatabase } from '../models/SessionDatabase'
import { ExecutionContext } from 'graphql/execution/execute'
import { Authenticator } from '../models/Authenticator'
import EventHandler from '../models/EventHandler'
import { AccessTokenContent } from './AccessTokenContent'
import { Request } from 'express'

export interface CustomContextData {
  currentUser: AccessTokenContent
  db: SessionDatabase
  auth: Authenticator
  events: EventHandler
  req: Request
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
  if (!('auth' in data)) {
    throw new Error('Decoded context error. Missing required field "auth"')
  }
  if (!('events' in data)) {
    throw new Error('Decoded context error. Missing required field "events"')
  }
  if (!('req' in data)) {
    throw new Error('Decoded context error. Missing required field "req"')
  }
}
