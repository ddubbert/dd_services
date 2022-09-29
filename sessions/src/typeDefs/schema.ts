import {gql} from 'apollo-server'

export default gql`
  scalar DateTime

  type Query {
    allSessions: [Session!]!
  }
    
  type Session @key(fields: "id") {
    id: ID!
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
