require('dotenv').config();
import { createAuthMiddleware } from './utils/authMiddleware'
import typeDefs from './typeDefs/schema';
import resolvers from './resolvers/resolvers';
import createUserDB from './models/database';
import createAuthenticator from './models/authentication';
const { ApolloServer } = require('apollo-server');
const { buildSubgraphSchema } = require('@apollo/subgraph');

(async () => {
  const db = await createUserDB();
  const auth = createAuthenticator(db);
  const authenticate = createAuthMiddleware(auth);

  const server = new ApolloServer({
    schema: buildSubgraphSchema({ typeDefs, resolvers }),
    context: async ({ req }) => ({ currentUser: await authenticate(req), db, auth }),
    // Subscriptions are not currently supported in Apollo Federation
    subscriptions: false,
    introspection: true,
    playground: true
  });

  server.listen({
    port: 80,
  }).then(({ url }) => {
    console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}${server.graphqlPath}`);
  }).catch(err => {console.error(err)});
})()
