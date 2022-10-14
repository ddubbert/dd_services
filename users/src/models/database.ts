import moment from 'moment';
import { Prisma, PrismaClient, User } from '@prisma/client'

const prisma = new PrismaClient()

const createDeletionIndex = async () : Promise<Prisma.JsonObject> =>
  await prisma.$runCommandRaw({
    createIndexes: 'users',
    indexes: [
      {
        key: { refreshEnd: 1 },
        name: 'ExpirationIndex',
        expireAfterSeconds: 0,
        partialFilterExpression: { isPermanent: false },
      },
    ],
  });

const getUserBy = async (id: string) : Promise<User|null> => (await prisma.user.findFirst({ where: { id: id } }))

const getUser = async (where: Prisma.UserWhereInput) : Promise<User|null> =>
  (await prisma.user.findFirst({ where }))

const getUsers = async (where: Prisma.UserWhereInput = {}) : Promise<User[]|null> =>
  (await prisma.user.findMany({ where }))

const createUser = async (input: Prisma.UserCreateInput) : Promise<User|never> =>
  (await prisma.user.create({ data: input }))

const deleteUser = async (where: Prisma.UserWhereUniqueInput) : Promise<User|never> =>
  (await prisma.user.delete({ where }))

const updateUser = async (where: Prisma.UserWhereUniqueInput, input: Prisma.UserUpdateInput) : Promise<User|never> => {
  const data = { ...input, updatedAt: moment().toISOString() }

  return await prisma.user.update({
    where,
    data,
  })
}

export async function createUserDB() : Promise<UserDatabase> {
  console.log(await createDeletionIndex());

  return {
    getUser,
    getUserBy,
    getUsers,
    createUser,
    deleteUser,
    updateUser,
  } as UserDatabase
}

export default createUserDB

export interface UserDatabase {
  getUserBy: (id: string) => Promise<User|null>,
  getUser: (where?: Prisma.UserWhereInput) => Promise<User|null>,
  getUsers: (where?: Prisma.UserWhereInput) => Promise<User[]|null>,
  createUser: (input: Prisma.UserCreateInput) => Promise<User|never>,
  deleteUser: (where: Prisma.UserWhereUniqueInput) => Promise<User|never>,
  updateUser: (where: Prisma.UserWhereUniqueInput, input: Prisma.UserUpdateInput) => Promise<User|never>,
}
