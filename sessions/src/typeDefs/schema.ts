import {gql} from 'apollo-server'

export default gql`
  scalar DateTime

  type Query {
    allSessions: [Session!]!
  }

  type Mutation {
    createSession(input: SessionCreateInput): Session!
    addParticipant(sessionId: ID!, userId: ID!): Session!
  }

  input SessionCreateInput {
    title: String!
    owner: ID!
    participants: [ID!]!
  }
    
  type Session @key(fields: "id") {
    id: ID!
    title: String!
    owner: User!
    participants: [User!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    deletedAt: DateTime!
  }

  type User @key(fields: "id") {
    id: ID!
    sessions: [Session!]!
  }

  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])
`
