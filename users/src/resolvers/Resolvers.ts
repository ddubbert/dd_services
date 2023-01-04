import { GraphQLDateTime } from 'graphql-iso-date'
import { AuthMethod } from '../types/auth/AuthMethod'
import { adjectives, animals, colors, Config, uniqueNamesGenerator } from 'unique-names-generator'
import { Prisma, User } from '@prisma/client'
import { Maybe } from '@graphql-tools/utils'
import { UserAuth } from '../types/auth/UserAuth'
import { AuthenticationError } from 'apollo-server'
import { DeletionStatus } from '../types/DeletionStatus'
import { FieldResolverFn, ReferenceResolverFn } from '../types/ResolverFn'

const nameConfig: Config = {
  dictionaries: [ adjectives, colors, animals ],
  separator: ' ',
}

const getWhereInputFor = (currentUser: UserAuth): Maybe<Prisma.UserWhereInput> => {
  switch (currentUser.authMethod) {
  case AuthMethod.KEYCLOAK: {
    return { authId: currentUser.userId }
  }
  case AuthMethod.DD_SERVICES: {
    return { id: currentUser.userId }
  }
  case AuthMethod.NONE: {
    return null
  }}
}

const getCreateInputFor = (currentUser: Maybe<UserAuth>): Prisma.UserCreateInput => {
  const userCreateInput: Prisma.UserCreateInput = { nickname: uniqueNamesGenerator(nameConfig) }

  if (currentUser && currentUser.authMethod === AuthMethod.KEYCLOAK) {
    userCreateInput.isPermanent = true
    userCreateInput.nickname = currentUser.nickname
    userCreateInput.authId = currentUser.userId
    userCreateInput.email = currentUser.email
  }

  return userCreateInput
}

export default {
  DateTime: GraphQLDateTime,
  DeletionStatus: {
    SUCCESSFUL: DeletionStatus.SUCCESSFUL,
    UNSUCCESSFUL: DeletionStatus.UNSUCCESSFUL,
  },
  Query: {
    allUsers: (async (parent, args, context) => (await context.db.getUsers())) as FieldResolverFn,
    currentUser: (async (parent, args, context) => {
      const where = getWhereInputFor(context.currentUser)
      if (!where) {throw new AuthenticationError('Not authenticated.')}
      const user = await context.db.getUser(where)
      if (!user) {throw new Error('User not found.')}
      return user
    }) as FieldResolverFn,
  },
  Mutation: {
    createOrLoginUser: (async (parent, args, context) => {
      const where = getWhereInputFor(context.currentUser)
      const dbUser: Maybe<User> = context.currentUser.authMethod === AuthMethod.DD_SERVICES || !where
        ? null
        : await context.db.getUser(where)
      const user = dbUser ?? await context.db.createUser(getCreateInputFor(context.currentUser))
      const authenticationDetails = await context.auth.createAuthFor(user)

      return { user, authenticationDetails }
    }) as FieldResolverFn,
    refreshAuth: (async (parent, args, context) => (await context.auth.verifyAndRenewAuth(args.token))) as FieldResolverFn,
    deleteUser: (async (parent, args, context) => {
      if (context.currentUser.userId !== args.userId)
      {throw new AuthenticationError('Not allowed to delete this user.')}

      try {
        await context.db.deleteUser({ id: args.userId })
        return { status: DeletionStatus.SUCCESSFUL }
      } catch (e) {
        return { status: DeletionStatus.UNSUCCESSFUL, message: e instanceof Error ? e.message : null }
      }
    }) as FieldResolverFn,
  },
  User: {
    __resolveReference: (async (user, context) => (await context.db.getUserBy(user.id))) as ReferenceResolverFn,
    email: (async (parent, args, context, info) => {
      const { userId } = context.currentUser
      return (info.path?.prev?.prev?.key === 'createOrLoginUser' || userId === parent.id) ? parent.email : null
    }) as FieldResolverFn,
  },
}
