import { File, Prisma, PrismaPromise, UserSession } from '@prisma/client'

export type DBFunction<T> = () => PrismaPromise<T>

export type DBFunctionPayload = Prisma.BatchPayload | Prisma.JsonObject | RawUpdatePayload | File | UserSession | null

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
