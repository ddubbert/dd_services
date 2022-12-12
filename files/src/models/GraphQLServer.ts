import EventHandler from './EventHandler'
import { FileDatabase } from './FileDatabase'
import { UserSessionDatabase } from './UserSessionDatabase'
import { Authenticator } from './Authenticator'
import { URLSigner } from './URLSigner'
import express, { RequestHandler } from 'express'
import { createRateLimitDirective } from './RateLimitDirective'
import { buildSubgraphSchema } from '@apollo/subgraph'
import typeDefs from '../typeDefs/schema'
import { gql } from 'apollo-server'
import resolvers from '../resolvers/resolvers'
import { GraphQLResolverMap } from '@apollo/subgraph/src/schema-helper/resolverMap'
import http from 'http'
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import cors from 'cors'
import { json } from 'body-parser'
import { expressMiddleware } from '@apollo/server/express4'
import { CustomContextData } from '../types/Context'
import { UploadHandler } from './UploadHandler'

export const startGraphQLServer = async (
  events: EventHandler,
  fileDB: FileDatabase,
  userSessionDB: UserSessionDatabase,
  auth: Authenticator,
  signer: URLSigner,
  uploadHandler: UploadHandler,
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
        currentUser: await auth.resolveUser(req),
        fileDB,
        userSessionDB,
        auth,
        events,
        signer,
        uploadHandler,
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
