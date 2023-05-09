import { GraphQLDateTime } from 'graphql-iso-date'
import { SubscriptionResolveFn, SubscriptionSubscribeFn } from '../types/ResolverFn'
import { UserSessionDatabase } from '../models/UserSessionDatabase'
import { SubscriptionPayload, SubscriptionSessionEvent, SubscriptionUserEvent } from '../types/SubscriptionPayload'
import { AuthenticationError } from 'apollo-server'
import { EntityType } from '../types/kafka/Entity'

const userIsMemberInAllSessions = async (
  sessions: string[],
  user: string,
  db: UserSessionDatabase): Promise<boolean> => {
  const userSessions = await db.getUserSessions({ session: { in: sessions } })

  return userSessions?.reduce((acc, it) => acc && it.users.includes(user), true) ?? false
}

const subscriptionResolver = (
  async (message): Promise<SubscriptionPayload> => message.content
) as SubscriptionResolveFn

export default {
  DateTime: GraphQLDateTime,
  EntityType: {
    USER: EntityType.USER,
    SESSION: EntityType.SESSION,
    FILE: EntityType.FILE,
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
    CONNECTED_SESSION_UPDATED: SubscriptionSessionEvent.CONNECTED_SESSION_UPDATED,
    CONNECTED_SESSION_REMOVED: SubscriptionSessionEvent.CONNECTED_SESSION_REMOVED,
    FILE_ADDED: SubscriptionSessionEvent.FILE_ADDED,
    FILE_REMOVED: SubscriptionSessionEvent.FILE_REMOVED,
  },
  Query: {
    _: () => 'placeholder',
  },
  Subscription: {
    sessionUpdates: {
      subscribe: (async (parent, args, context) => {
        console.log(parent)
        console.log(args)
        console.log(context)
        if (!(await userIsMemberInAllSessions([args.sessionId], context.currentUser.userId, context.db))) {
          throw new AuthenticationError('Not authorized.')
        }

        return context.pubSub.asyncIterator(`session_${args.sessionId}`)
      }) as SubscriptionSubscribeFn,
      resolve: subscriptionResolver,
    },
    userUpdates: {
      subscribe: (
        async (parent, args, context) => {
          console.log(parent)
          console.log(args)
          console.log(context)
          return context.pubSub.asyncIterator(`user_${context.currentUser.userId}`)
        }
      ) as SubscriptionSubscribeFn,
      resolve: subscriptionResolver,
    },
  },
}
