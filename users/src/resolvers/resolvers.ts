import { GraphQLDateTime } from 'graphql-iso-date';
import { Context } from '../types/context';
import { AuthMethod } from '../types/authMethod';
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';
import { Prisma, User } from '@prisma/client';
import { Maybe } from '@graphql-tools/utils';
import { UserAuth } from '../types/userAuth';
import {AuthenticationError} from 'apollo-server'

const nameConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: ' ',
}

const getUserWhereInputFor = (currentUser: UserAuth) : Prisma.UserWhereInput|never => {
  const where : Prisma.UserWhereInput = {};

  if (currentUser.authMethod === AuthMethod.KEYCLOAK) {
    where.authId = currentUser.userId;
  } else where.id = currentUser.userId;

  return where;
}

const getUserCreateInputFor = (currentUser: Maybe<UserAuth>) : Prisma.UserCreateInput => {
  let userCreateInput : Prisma.UserCreateInput = { nickname: uniqueNamesGenerator(nameConfig) };

  if (currentUser && currentUser.authMethod === AuthMethod.KEYCLOAK) {
    userCreateInput.isPermanent = true;
    userCreateInput.nickname = currentUser.nickname;
    userCreateInput.authId = currentUser.userId;
  }

  return userCreateInput
}

const getUserIfExists = async (context: Context) : Promise<User|null> => {
  if (!context.currentUser) return null;
  const where : Prisma.UserWhereInput = getUserWhereInputFor(context.currentUser);

  return await context.db.getUser(where);
}

export default {
  DateTime: GraphQLDateTime,
  Query: {
    allUsers: async (parent, args, context: Context) => (await context.db.getUsers()),
    currentUser: async (parent, args, context: Context) => {
      const user = await getUserIfExists(context);
      if (!user) throw new AuthenticationError('User not found.');
      return user;
    },
  },
  Mutation: {
    createOrLoginUser: async (parent, args, context: Context) => {
      const dbUser: Maybe<User> = await getUserIfExists(context);
      const user = dbUser ?? await context.db.createUser(getUserCreateInputFor(context.currentUser));
      const authenticationDetails = await context.auth.createAuthFor(user);
      return { user, authenticationDetails };
    },
    refreshAuth: async (parent, args, context: Context) => (await context.auth.checkAndRenew(args.token)),
  },
  User: {
    __resolveReference: async (user, context: Context) => (await context.db.getUserBy(user.id)),
  },
}
