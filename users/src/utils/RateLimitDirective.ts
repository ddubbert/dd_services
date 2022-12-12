import Redis from 'ioredis'
import { RateLimitDirective, rateLimitDirective } from 'graphql-rate-limit-directive'
import { IRateLimiterStoreOptions, RateLimiterRedis } from 'rate-limiter-flexible'
import { Context } from '../types/Context'
import { Maybe } from '@graphql-tools/utils'
import { AuthMethod } from '../types/auth/AuthMethod'

const getUserIP = (context: Context): Maybe<string> => {
  const request = context.req
  if (!request) { return null }
  const headers = request.headers
  console.log(headers)
  if (!headers) { return null }
  const ipAddress = headers['x-forwarded-for']
  if (!ipAddress) { return null }
  return ipAddress
}

export const createRateLimitDirective = (): RateLimitDirective => {
  const redisOptions = {
    host: process.env.CACHE_HOST || '127.0.0.1',
    port: process.env.CACHE_PORT ? parseInt(process.env.CACHE_PORT, 10) : 6379,
    password: process.env.CACHE_PASSWORD || '',
    retryStrategy: (times: number): number => Math.min(times * 50, 2000)
  }
  const redisClient = new Redis(redisOptions)

  return rateLimitDirective<Context, IRateLimiterStoreOptions>({
    keyGenerator: (directiveArgs, source, args, context) => {
      if (context.currentUser.authMethod === AuthMethod.NONE) {
        const ip = getUserIP(context)
        return ip ?? 'userRequest'
      }
      return context.currentUser.userId
    },
    limiterClass: RateLimiterRedis,
    limiterOptions: {
      keyPrefix: '',
      storeClient: redisClient,
    },
  })
}
