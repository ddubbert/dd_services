type User = {
  id: string;
  nickname: string;
}

const users: Array<User> = [
  {
    id: "1",
    nickname: "penis",
  },
  {
    id: "2",
    nickname: "penis2",
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
