import { GraphQLDateTime } from 'graphql-iso-date';
import db from '../models/database'

export default {
  DateTime: GraphQLDateTime,
  Query: {
    allSessions: async (parent, args, context) => (await db.getSessions()),
  },
  Mutation: {
    createSession: async (parent, args) => (await db.createSession(args.input)),
    addParticipant: async (parent, args) => (
      await db.updateSession({ id: args.sessionId }, { participants: { push: args.userId } })
    )
  },
  Session: {
    __resolveReference: async (session) => {
      return await db.getSessionBy(session.id)
    },
    owner: async (parent, args, context) => ({ id: parent.owner }),
    participants: async (parent) => {
      console.log(parent)
      console.log(parent.participants)
      return parent.participants.map(id => ({ id }))
    },
  },
  User: {
    sessions: async (user) => {
      return await db.getSessions({ owner: user.id })
      // return sessions.filter(s => s.owner.id == parent.id || s.participants.some(p => p.id == parent.id))
    }
  }
}
