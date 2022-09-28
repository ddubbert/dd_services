require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { ApolloGateway, IntrospectAndCompose } = require('@apollo/gateway');
import { createProxyMiddleware } from 'http-proxy-middleware';

(async () => {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'users', url: 'http://users' },
        { name: 'files', url: 'http://files/graphql' },
        // ...additional subgraphs...
      ],
    }),
  });

  const server = new ApolloServer({
    gateway,
    // Subscriptions are not currently supported in Apollo Federation
    subscriptions: false,
    introspection: true,
    playground: true
  });

  await server.start()

  const app = express()

  app.use(
    '/static',
    createProxyMiddleware({
      target: 'http://files',
      changeOrigin: false,
    })
  );

  server.applyMiddleware({ app });

  await new Promise<void>(r => app.listen({ port: 80 }, r));

  console.log(`🚀 Server ready at http://localhost:80${server.graphqlPath}`);
})()
