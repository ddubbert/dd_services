import { Prisma, PrismaPromise, Session } from '@prisma/client'

export type DBFunction<T> = () => PrismaPromise<T>

export type DBFunctionPayload = Prisma.BatchPayload | Prisma.JsonObject | RawUpdatePayload | Session | null

export type RawUpdatePayload = {
  n: number
  nModified: number
  ok: number
  upserted?: any[]
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyBatchPayload(data: unknown): asserts data is Prisma.BatchPayload {
  if (!(data instanceof Object)) {
    throw new Error('Decoded payload error. BatchPayload must be an object')
  }
  if (!('count' in data)) {
    throw new Error('Decoded payload error. Missing required field "count"')
  }
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifySession(data: unknown): asserts data is Session {
  if (!(data instanceof Object)) {
    throw new Error('Decoded session error. Session must be an object')
  }
  if (!('id' in data)) {
    throw new Error('Decoded session error. Missing required field "id"')
  }
  if (!('title' in data)) {
    throw new Error('Decoded session error. Missing required field "title"')
  }
  if (!('owners' in data)) {
    throw new Error('Decoded session error. Missing required field "owners"')
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!(Array.isArray(data.owners))) {
    throw new Error('Decoded session error. Field "owners" is no array')
  }
  if (!('participants' in data)) {
    throw new Error('Decoded session error. Missing required field "participants"')
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!(Array.isArray(data.participants))) {
    throw new Error('Decoded session error. Field "participants" is no array')
  }
  if (!('createdAt' in data)) {
    throw new Error('Decoded session error. Missing required field "createdAt"')
  }
  if (!('updatedAt' in data)) {
    throw new Error('Decoded session error. Missing required field "updatedAt"')
  }
  if (!('deletedAt' in data)) {
    throw new Error('Decoded session error. Missing required field "deletedAt"')
  }
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyRawUpdatePayload(data: unknown): asserts data is RawUpdatePayload {
  if (!(data instanceof Object)) {
    throw new Error('Decoded raw update payload error. Raw update payload must be an object')
  }
  if (!('n' in data)) {
    throw new Error('Decoded raw update payload error. Missing required field "n"')
  }
  if (!('nModified' in data)) {
    throw new Error('Decoded raw update payload error. Missing required field "nModified"')
  }
  if (!('ok' in data)) {
    throw new Error('Decoded raw update payload error. Missing required field "ok"')
  }
}
