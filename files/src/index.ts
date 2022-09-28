require('dotenv').config();
const path = require('path')
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { buildSubgraphSchema } = require('@apollo/subgraph');
import typeDefs from './typeDefs/schema';
import resolvers from './resolvers/resolvers';

(async () => {
  const server = new ApolloServer({
    schema: buildSubgraphSchema({ typeDefs, resolvers }),
    // Subscriptions are not currently supported in Apollo Federation
    subscriptions: false,
    introspection: true,
    playground: true,
    csrfPrevention: true
  });

  await server.start()

  const app = express()

  app.use('/static', express.static(path.join(__dirname, '../public')))

  server.applyMiddleware({ app });

  await new Promise<void>(r => app.listen({ port: 80 }, r));

  console.log(`🚀 Server ready at http://files:80${server.graphqlPath}`);
})()
