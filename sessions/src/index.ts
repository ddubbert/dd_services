require('dotenv').config()

import { CustomContextData } from './types/Context'
import createProcessors from './utils/EventMessageProcessorCreator'
import createSessionDB, { SessionDatabase } from './models/SessionDatabase'
import createAuthenticator, { Authenticator } from './models/Authenticator'
import typeDefs from './typeDefs/Schema'
import resolvers from './resolvers/Resolvers'
import EventHandler from './models/EventHandler'
import { createRateLimitDirective } from './utils/RateLimitDirective'
import { gql } from 'apollo-server'
import express, { RequestHandler } from 'express'
import { buildSubgraphSchema } from '@apollo/subgraph'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { GraphQLResolverMap } from '@apollo/subgraph/src/schema-helper/resolverMap'
import * as http from 'http'
import cors from 'cors'
import { json } from 'body-parser'

const startGraphQLServer = async (
  events: EventHandler,
  db: SessionDatabase,
  auth: Authenticator,
  middleware: RequestHandler[] = [],
): Promise<void> => {
  const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = createRateLimitDirective()
  const subgraph = buildSubgraphSchema({
    typeDefs: [ typeDefs, gql`${rateLimitDirectiveTypeDefs}` ],
    resolvers: resolvers as GraphQLResolverMap<unknown>,
  })
  const schema = rateLimitDirectiveTransformer(subgraph)

  const appQL = express()
  const graphqlServer = http.createServer(appQL)
  const server = new ApolloServer({
    schema,
    introspection: true,
    csrfPrevention: true,
    plugins: [ ApolloServerPluginDrainHttpServer({ httpServer: graphqlServer }) ],
  })

  await server.start()

  appQL.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    json(),
    auth.expressMiddleware,
    ...middleware,
    expressMiddleware(server, {
      context: async ({ req }): Promise<CustomContextData> => ({
        currentUser: req.currentUser,
        db,
        auth,
        events,
        req,
      }),
    }),
  )

  await new Promise<void>((resolve) => graphqlServer.listen({
    port: process.env.PORT ?? 80,
  }, resolve)).then((): void => {
    console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}/graphql`)
  }).catch((err): void => {
    console.error(err)
    throw err
  })
}

(async (): Promise<void> => {
  const events = new EventHandler()
  const db = await createSessionDB(events)
  const auth = createAuthenticator()
  createProcessors(events, db)
  await events.start()

  await startGraphQLServer(events, db, auth)
})()
