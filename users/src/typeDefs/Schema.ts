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
    deleteUser(userId: String!): DeletionResponse!
  }
    
  type User @key(fields: "id") {
    id: ID!
    nickname: String!
    isPermanent: Boolean!
    email: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthenticationDetails {
    accessToken: String!
    tokenType: String!
    expiresIn: Int!
    refreshExpiresIn: Int!
    refreshToken: String!
    refreshUri: String!
  }

  type UserAndAuthenticationDetails {
    user: User!
    authenticationDetails: AuthenticationDetails!
  }

  type DeletionResponse @shareable {
    status: DeletionStatus!
    message: String
  }

  enum DeletionStatus {
    SUCCESSFUL
    UNSUCCESSFUL
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])
`
