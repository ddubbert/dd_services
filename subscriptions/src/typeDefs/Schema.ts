import { gql } from 'apollo-server'

export default gql`
  scalar DateTime

  type Subscriptions {
      sessionUpdates(sessionId: ID!): SessionUpdate!
      userUpdates: UserUpdate!
  }

  type Entity {
      id: ID!
      type: EntityType!
      connectedTo: [Entity!]
  }

  type UserUpdate {
      entity: Entity!
      event: UserEvent!
  }

  type SessionUpdate {
      entity: Entity!
      event: SessionEvent!
  }

  enum SessionEvent {
      SESSION_UPDATED
      SESSION_DELETED
      USER_ADDED
      USER_REMOVED
      FILE_ADDED
      FILE_REMOVED
  }

  enum UserEvent {
      USER_UPDATED
      USER_DELETED
      SESSION_ADDED
      SESSION_UPDATED
      SESSION_REMOVED
      FILE_ADDED
      FILE_REMOVED
  }

  enum EntityType {
      USER
      SESSION
      FILE
  }
`
