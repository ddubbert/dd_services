require('dotenv').config();

import { RemoteGraphQLDataSource } from '@apollo/gateway'
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { ApolloGateway, IntrospectAndCompose } = require('@apollo/gateway');
import { createProxyMiddleware } from 'http-proxy-middleware';

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    if (context?.req?.headers?.authorization) {
      request.http.headers.set('authorization', context.req.headers.authorization);
      // request.https.headers.set('authorization', context.req.headers.authorization);
    }
  }
}

(async () => {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'users', url: 'http://users' },
        { name: 'files', url: 'http://files/graphql' },
        { name: 'sessions', url: 'http://sessions' },
        // ...additional subgraphs...
      ],
    }),
    buildService: ({ _name, url }) => {
      return new AuthenticatedDataSource({ url });
    },
  });

  const server = new ApolloServer({
    gateway,
    // Subscriptions are not currently supported in Apollo Federation
    context: async ({ req }) => {
      return { req };
    },
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
