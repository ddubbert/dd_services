type User = {
  id: string;
  nickname: string;
  sessions: Array<string>;
}

type File = {
  id: string;
}

const users: Array<User> = [
  {
    id: "1",
    nickname: "penis",
    sessions: [],
  },
  {
    id: "2",
    nickname: "penis2",
    sessions: [],
  }
]

export default {
  Query: {
    allUsers: async (parent, args, context) => (users)
  },
  User: {
    __resolveReference(user){
      return users.find(u => u.id === user.id);
    }
  },
}
