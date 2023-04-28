import { GraphQLDateTime } from 'graphql-iso-date'
import { Context } from '../types/Context'
import moment from 'moment'
import { DeletionStatus } from '../types/DeletionStatus'
import { Prisma } from '@prisma/client'
import { DBFunction, verifyRawUpdatePayload, verifySession } from '../types/DBFunction'
import { depthLimitedFieldResolver, depthLimitedReferenceResolver } from '../utils/PathReader'
import { SubscriptionResolverFn } from '../types/ResolverFn'
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from '../types/Errors'
import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { EntityType } from '../types/kafka/Entity'
import { MessageEvent } from '../types/kafka/EventMessage'
import {
  SubscriptionEntityType,
  SubscriptionSessionEvent,
  SubscriptionUserEvent
} from '../types/SubscriptionPayload'
import { withFilter } from 'graphql-subscriptions'
import { AuthenticationError } from 'apollo-server'

const userIsMemberInAllSessions = async (
  sessions: string[],
  user: string,
  db: UserSessionDatabase): Promise<boolean> => {
  const userSessions = await db.getUserSessions({ session: { in: sessions } })

  return userSessions?.reduce((acc, it) => acc && it.users.includes(user), true) ?? false
}

export default {
  DateTime: GraphQLDateTime,
  EntityType: {
    USER: SubscriptionEntityType.USER,
    SESSION: SubscriptionEntityType.SESSION,
    FILE: SubscriptionEntityType.FILE,
  },
  UserEvent: {
    USER_UPDATED: SubscriptionUserEvent.USER_UPDATED,
    USER_DELETED: SubscriptionUserEvent.USER_DELETED,
    SESSION_ADDED: SubscriptionUserEvent.SESSION_ADDED,
    SESSION_UPDATED: SubscriptionUserEvent.SESSION_UPDATED,
    SESSION_REMOVED: SubscriptionUserEvent.SESSION_REMOVED,
    FILE_ADDED: SubscriptionUserEvent.FILE_ADDED,
    FILE_REMOVED: SubscriptionUserEvent.FILE_REMOVED,
  },
  SessionEvent: {
    SESSION_UPDATED: SubscriptionSessionEvent.SESSION_UPDATED,
    SESSION_DELETED: SubscriptionSessionEvent.SESSION_DELETED,
    USER_ADDED: SubscriptionSessionEvent.USER_ADDED,
    USER_REMOVED: SubscriptionSessionEvent.USER_REMOVED,
    FILE_ADDED: SubscriptionSessionEvent.FILE_ADDED,
    FILE_REMOVED: SubscriptionSessionEvent.FILE_REMOVED,
  },
  Subscription: {
    sessionUpdates: {
      subscribe: (async (parent, args, context) => {
        if (!(await userIsMemberInAllSessions([args.sessionId], context.currentUser.userId, context.db))) {
          throw new AuthenticationError('Not authorized.')
        }
        // TODO
        return withFilter(
          () => context.pubSub.asyncIterator('COMMENT_ADDED'),
          (payload, variables) => {
            return (
              payload.commentAdded.repository_name === variables.repoFullName
            )
          },
        )
      }) as SubscriptionResolverFn,
    },
    userUpdates: () => {
      // TODO
    },
    fileUpdates: () => {
      // TODO
    },
  },
}
