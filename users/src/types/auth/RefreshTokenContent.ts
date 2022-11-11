export type RefreshTokenContent = {
  userId: string
  refreshKey: string
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyRefreshTokenContent(data: unknown): asserts data is RefreshTokenContent {
  if (!(data instanceof Object)) {
    throw new Error('Decoded token error. Token must be an object')
  }
  if (!('userId' in data)) {
    throw new Error('Decoded token error. Missing required field "id"')
  }
  if (!('refreshKey' in data)) {
    throw new Error('Decoded token error. Missing required field "id"')
  }
}
