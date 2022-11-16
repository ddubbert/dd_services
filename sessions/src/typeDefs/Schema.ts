import { gql } from 'apollo-server'

export default gql`
  scalar DateTime

  type Query @rateLimit(limit: 30, duration: 60){
    allSessions: [Session!]!
    getSession(sessionId: ID!): Session!
  }

  type Mutation @rateLimit(limit: 30, duration: 60){
    createSession(input: SessionCreateInput!): Session!
    addParticipantsToSession(sessionId: ID!, userIds: [ID!]!): Session!
    addOwnersToSession(sessionId: ID!, userIds: [ID!]!): Session!
    joinSessionAsParticipant(sessionId: ID!): Session!
    joinSessionAsOwner(sessionId: ID!): Session!
    prolongSession(sessionId: ID!, ttl: TTL = X_SHORT): Session!
    deleteSession(sessionId: String!): DeletionResponse!
    removeUserFromSession(sessionId: ID!, userId: ID!): Session!
    leaveSession(sessionId: ID!): DeletionResponse!
    addSessionAsChild(parentSession: ID!, childSession: ID!): Session!
  }

  input SessionCreateInput {
    title: String!
    ttl: TTL = SHORT
    parentSession: ID
  }

  type Session @key(fields: "id") {
    id: ID!
    title: String!
    owners: [User]!
    participants: [User]
    parentSession: Session
    childSessions: [Session!]
    createdAt: DateTime!
    updatedAt: DateTime!
    deletedAt: DateTime!
  }

  type User @key(fields: "id") {
    id: ID!
    sessions: [Session!]
  }

  enum TTL {
    X_LONG
    LONG
    MEDIUM
    SHORT
    X_SHORT
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
