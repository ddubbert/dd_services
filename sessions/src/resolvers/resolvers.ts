import { GraphQLDateTime } from 'graphql-iso-date';
import moment from 'moment';

type Session = {
  id: string;
  owner: User;
  participants: Array<User>;
  createdAt: String;
  updatedAt: String;
  deletedAt: String;
}

type User = {
  id: string;
}

const sessions: Array<Session> = [
  {
    id: "1",
    owner: { id: "1" },
    participants: [{ id: "1" }, { id: "2"}],
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString(),
    deletedAt: moment().add(2, 'h').toISOString(),
  },
  {
    id: "2",
    owner: { id: "1" },
    participants: [{ id: "1" }],
    createdAt: moment().subtract(2, 'h').toISOString(),
    updatedAt: moment().subtract(2, 'h').toISOString(),
    deletedAt: moment().toISOString(),
  }
]

export default {
  DateTime: GraphQLDateTime,
  Query: {
    allSessions: async (parent, args, context) => (sessions)
  },
  Session: {
    __resolveReference(session){
      return sessions.find(s => s.id === session.id);
    }
  },
  User: {
    sessions: async (parent, args, context) => {
      return sessions.filter(s => s.owner.id == parent.id || s.participants.some(p => p.id == parent.id))
    }
  }
}
