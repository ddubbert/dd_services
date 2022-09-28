require('dotenv').config();
const { ApolloServer } = require('apollo-server');
const { buildSubgraphSchema } = require('@apollo/subgraph');
import typeDefs from './typeDefs/schema';
import resolvers from './resolvers/resolvers';

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
  // Subscriptions are not currently supported in Apollo Federation
  subscriptions: false,
  introspection: true,
  playground: true
});

server.listen({
  port: 80,
}).then(({ url }) => {
  console.log(`🚀 Server ready at http://users:80${server.graphqlPath}`);
}).catch(err => {console.error(err)});
