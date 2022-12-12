require('dotenv').config();

import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { RemoteGraphQLDataSource } from '@apollo/gateway'
import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway'

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    if (context?.req?.headers?.authorization) {
      request.http.headers.set('authorization', context.req.headers.authorization);
      // request.https.headers.set('authorization', context.req.headers.authorization);
    }
    if (context?.req?.headers['x-forwarded-for']) {
      request.http.headers.set('x-forwarded-for', context.req.headers['x-forwarded-for']);
    }
  }
}

(async () => {
  console.log(process.env.USERS_URL)
  console.log(process.env.SESSIONS_URL)
  console.log(process.env.FILES_URL)
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'users', url: process.env.USERS_URL ?? 'http://users' },
        { name: 'files', url: process.env.FILES_URL ?? 'http://files' },
        { name: 'sessions', url: process.env.SESSIONS_URL ?? 'http://sessions' },
        // ...additional subgraphs...
      ],
      introspectionHeaders: {
        Authorization: `Bearer ${process.env.INTROSPECTION_BEARER_TOKEN ?? 'abc123'}`
      }
    }),
    buildService: ({ url }) => {
      return new AuthenticatedDataSource({ url });
    },
  });

  const server = new ApolloServer({
    gateway,
    introspection: true,
    csrfPrevention: true,
    plugins: [ ApolloServerPluginLandingPageLocalDefault({ footer: false }) ],
  });

  await startStandaloneServer(server, {
    listen: { port: +(process.env.PORT ?? 80) },
    context: async ({ req }) => {
      return { req };
    },
  });

  console.log(`🚀 Server ready at http://${process.env.HOST}:${process.env.PORT}/graphql`)
})()
