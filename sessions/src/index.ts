require('dotenv').config()

import { CustomContextData } from './types/Context'
import createProcessors from './utils/EventMessageProcessorCreator'
import createSessionDB from './models/SessionDatabase'
import createAuthenticator from './models/Authenticator'
import { createAuthMiddleware } from './utils/AuthMiddlewareCreator'
import typeDefs from './typeDefs/Schema'
import resolvers from './resolvers/Resolvers'
import EventHandler from './models/EventHandler'
import { createRateLimitDirective } from './utils/RateLimitDirective'
import { gql } from 'apollo-server'

const { ApolloServer } = require('apollo-server')
const { buildSubgraphSchema } = require('@apollo/subgraph');

(async (): Promise<void> => {
  const events = new EventHandler()
  const db = await createSessionDB(events)
  const auth = createAuthenticator()
  const authenticate = createAuthMiddleware(auth)
  createProcessors(events, db)
  await events.start()

  const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = createRateLimitDirective()
  const subgraph = buildSubgraphSchema({
    typeDefs: [ typeDefs, gql`${rateLimitDirectiveTypeDefs}` ],
    resolvers,
  })
  const schema = rateLimitDirectiveTransformer(subgraph)

  const server = new ApolloServer({
    schema,
    context: async ({ req }): Promise<CustomContextData> => ({
      currentUser: await authenticate(req),
      db,
      auth,
      events,
    }),
    subscriptions: false,
    introspection: true,
    playground: true,
  })

  server.listen({
    port: 80,
  }).then((): void => {
    console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}${server.graphqlPath}`)
  }).catch((err): void => {
    console.error(err)
  })
})()
