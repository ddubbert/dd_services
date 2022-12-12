import { ExecutionContext } from 'graphql/execution/execute'
import { Authenticator } from '../models/Authenticator'
import EventHandler from '../models/EventHandler'
import { AccessTokenContent } from './AccessTokenContent'
import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { FileDatabase } from '../models/FileDatabase'
import { URLSigner } from '../models/URLSigner'
import { Request } from 'express'
import { UploadHandler } from '../models/UploadHandler'

export interface CustomContextData {
  currentUser: AccessTokenContent
  fileDB: FileDatabase
  userSessionDB: UserSessionDatabase
  auth: Authenticator
  events: EventHandler
  signer: URLSigner
  uploadHandler: UploadHandler
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
  if (!('fileDB' in data)) {
    throw new Error('Decoded context error. Missing required field "fileDB"')
  }
  if (!('userSessionDB' in data)) {
    throw new Error('Decoded context error. Missing required field "userSessionDB"')
  }
  if (!('auth' in data)) {
    throw new Error('Decoded context error. Missing required field "auth"')
  }
  if (!('events' in data)) {
    throw new Error('Decoded context error. Missing required field "events"')
  }
  if (!('signer' in data)) {
    throw new Error('Decoded context error. Missing required field "signer"')
  }
  if (!('req' in data)) {
    throw new Error('Decoded context error. Missing required field "req"')
  }
}
