export interface Entity {
  id: string
  type: EntityType
  connectedTo?: Entity[]
}

export enum EntityType {
  USER = 'user',
  SESSION = 'session',
  FILE = 'file',
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyEntity(data: unknown): asserts data is Entity {
  if (!(data instanceof Object)) {
    throw new Error('Decoded entity error. Entity must be an object')
  }
  if (!('id' in data)) {
    throw new Error('Decoded entity error. Missing required field "id"')
  }
  if (!('type' in data)) {
    throw new Error('Decoded entity error. Missing required field "type"')
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!Object.values(EntityType).includes(data.type)) {
    throw new Error('Decoded entity error. Field "type" needs to be of type EntityType')
  }
  if ('connectedTo' in data) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!(Array.isArray(data.connectedTo))) {
      throw new Error('Decoded entity error. Field "connectedTo" is no array')
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    data.connectedTo.forEach(it => verifyEntity(it))
  }
}
