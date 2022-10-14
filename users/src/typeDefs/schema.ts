import {gql} from 'apollo-server'

export default gql`
  scalar DateTime

  type Query {
    allUsers: [User!]!
    currentUser: User!
  }

  type Mutation {
    createOrLoginUser: UserAndAuthenticationDetails!
    refreshAuth(token: String!): AuthenticationDetails!
  }
    
  type User @key(fields: "id") {
    id: ID!
    nickname: String!
    isPermanent: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthenticationDetails {
    accessToken: String!
    tokenType: String!
    expiresIn: Int!
    refreshExpiresIn: Int!
    refreshToken: String!
  }

  type UserAndAuthenticationDetails {
    user: User!
    authenticationDetails: AuthenticationDetails!
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])
`
