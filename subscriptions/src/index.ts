require('dotenv').config()

import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { CustomContextData } from './types/Context'
import createProcessors from './utils/EventMessageProcessorCreator'
import createUserSessionDB, { UserSessionDatabase } from './models/UserSessionDatabase'
import createAuthenticator, { Authenticator } from './models/Authenticator'
import typeDefs from './typeDefs/Schema'
import resolvers from './resolvers/Resolvers'
import EventHandler from './models/EventHandler'
import { createRateLimitDirective } from './utils/RateLimitDirective'
import { gql } from 'apollo-server'
import express, { RequestHandler } from 'express'
import { ApolloServer, GraphQLServerListener } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import * as http from 'http'
import cors from 'cors'
import { json } from 'body-parser'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'
import { RedisPubSub as PubSub } from 'graphql-redis-subscriptions'
import Redis, { RedisOptions } from 'ioredis'

const startGraphQLServer = async (
  events: EventHandler,
  db: UserSessionDatabase,
  auth: Authenticator,
  pubSub: PubSub,
  middleware: RequestHandler[] = [],
): Promise<void> => {
  const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = createRateLimitDirective()
  const schema = makeExecutableSchema({
    typeDefs: [ typeDefs, gql`${rateLimitDirectiveTypeDefs}` ],
    resolvers,
  })
  const rateLimitedSchema = rateLimitDirectiveTransformer(schema)

  const appQL = express()
  const graphQLServer = http.createServer(appQL)
  const wsServer = new WebSocketServer({
    server: graphQLServer,
    path: '/graphql',
  })

  const serverCleanup = useServer({ schema, context: async (ctx) => {
    const authHeader = ctx.extra.request.rawHeaders.find(it => it.startsWith('Bearer'))
    const token = ctx.connectionParams?.Authorization as string
      ?? ctx.connectionParams?.authentication as string
      ?? authHeader
      ?? null

    const currentUser = await auth.validateToken(token)

    return {
      currentUser,
      db,
      pubSub,
    }
  } }, wsServer)

  const apolloServer = new ApolloServer({
    schema: rateLimitedSchema,
    introspection: true,
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      ApolloServerPluginDrainHttpServer({ httpServer: graphQLServer }),
      {
        async serverWillStart(): Promise<void | GraphQLServerListener> {
          return {
            async drainServer(): Promise<void> {
              await serverCleanup.dispose()
            },
          }
        },
      },
    ],
  })

  await apolloServer.start()

  appQL.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    json(),
    auth.expressMiddleware,
    ...middleware,
    expressMiddleware(apolloServer, {
      context: async ({ req }): Promise<CustomContextData> => ({
        currentUser: req.currentUser,
        db,
        pubSub,
      }),
    }),
  )

  await new Promise<void>((resolve) => graphQLServer.listen({
    port: process.env.PORT ?? 8080,
  }, resolve)).then((): void => {
    console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}/graphql`)
  }).catch((err): void => {
    console.error(err)
    throw err
  })
}

(async (): Promise<void> => {
  const events = new EventHandler()
  const db = await createUserSessionDB()
  const auth = createAuthenticator()
  const redisOptions: RedisOptions = {
    host: process.env.CACHE_HOST ?? 'redisCache',
    port: +(process.env.CACHE_PORT ?? 6379),
    password: process.env.CACHE_PASSWORD ?? undefined,
    retryStrategy: (times) => {
      // reconnect after
      return Math.min(times * 50, 2000)
    }
  }

  const pubSub = new PubSub({
    publisher: new Redis(redisOptions),
    subscriber: new Redis(redisOptions),
  })

  createProcessors(events, db, pubSub)
  await events.start()

  await startGraphQLServer(events, db, auth, pubSub)
})()
