// eslint-disable-next-line
require('dotenv').config();

import EventHandler from './models/EventHandler'
import { createAuthMiddleware } from './utils/AuthMiddlewareCreator'
import typeDefs from './typeDefs/Schema'
import resolvers from './resolvers/Resolvers'
import createUserDB from './models/UserDatabase'
import createAuthenticator from './models/Authenticator'
import createProcessors from './utils/EventMessageProcessorCreator'

// eslint-disable-next-line
const { ApolloServer } = require('apollo-server');
// eslint-disable-next-line
const { buildSubgraphSchema } = require('@apollo/subgraph');

(async (): Promise<void> => {
  const events = new EventHandler()
  const db = await createUserDB(events)
  const auth = createAuthenticator(db)
  const authenticate = createAuthMiddleware(auth)
  createProcessors(events, db)
  await events.start()

  const server = new ApolloServer({
    schema: buildSubgraphSchema({ typeDefs, resolvers }),
    context: async ({ req }) => ({ currentUser: await authenticate(req), db, auth, events }),
    subscriptions: false,
    introspection: true,
    playground: true
  })

  server.listen({
    port: 80,
  }).then(({ url }) => {
    console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}${server.graphqlPath}`)
  }).catch(err => {console.error(err)})
})()
