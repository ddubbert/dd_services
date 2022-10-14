export type AccessTokenContent = {
  userId: string
  nickname: string
  isPermanent: boolean
}

export function verifyAccessToken(data: unknown): asserts data is AccessTokenContent {
  if (!(data instanceof Object))
    throw new Error('Decoded token error. Token must be an object');
  if (!('userId' in data))
    throw new Error('Decoded token error. Missing required field "userId"');
  if (!('nickname' in data))
    throw new Error('Decoded token error. Missing required field "nickname"');
  if (!('isPermanent' in data))
    throw new Error('Decoded token error. Missing required field "isPermanent"');
}
