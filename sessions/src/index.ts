import {GraphQLSchema} from 'graphql/type'

require('dotenv').config();
const { ApolloServer } = require('apollo-server');
const { buildSubgraphSchema } = require('@apollo/subgraph');
import typeDefs from './typeDefs/schema';
import resolvers from './resolvers/resolvers';
import { envelop, useSchema } from '@envelop/core';
import { keycloakAuth } from './utils/auth'

const schema: GraphQLSchema = buildSubgraphSchema({ typeDefs, resolvers });
const getEnveloped = envelop({
  plugins: [useSchema(schema), keycloakAuth],
});

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
  context: async ({ req }) => {
    try {
      const { contextFactory } = getEnveloped({ req });
      const context = await contextFactory()
      console.log("Kontext:")
      console.log(context)
      return context
    } catch (e) {
      console.log(e)
      return {}
    }
  },
  subscriptions: false,
  introspection: true,
  playground: true
});

server.listen({
  port: 80,
}).then(({ url }) => {
  console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}${server.graphqlPath}`);
}).catch(err => {console.error(err)});
