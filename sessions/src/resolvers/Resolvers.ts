import { GraphQLDateTime } from 'graphql-iso-date'
import { Context } from '../types/Context'
import { authorizeDelay, DeletionDelay } from '../types/DeletionDelay'
import moment from 'moment'
import { DeletionStatus } from '../types/DeletionStatus'
import { Prisma, Session } from '@prisma/client'
import { verifyRawUpdatePayload, verifySession } from '../types/DBFunction'
import { depthLimitedFieldResolver, depthLimitedReferenceResolver } from '../utils/PathReader'
import { FieldResolverFn } from '../types/ResolverFn'

const getSessionIfAuthorized = async (sessionId: string, context: Context): Promise<Session|never> => {
  const session = await context.db.getSessionBy(sessionId)
  const user = context.currentUser.userId

  if (!session || (!session.participants.includes(user) && !session.owners.includes(user))) {
    throw new Error('User is not authorized to access or update this session.')
  }

  return session
}

export default {
  DateTime: GraphQLDateTime,
  TTL: {
    X_LONG: DeletionDelay.X_LONG,
    LONG: DeletionDelay.LONG,
    MEDIUM: DeletionDelay.MEDIUM,
    SHORT: DeletionDelay.SHORT,
    X_SHORT: DeletionDelay.X_SHORT,
  },
  DeletionStatus: {
    SUCCESSFUL: DeletionStatus.SUCCESSFUL,
    UNSUCCESSFUL: DeletionStatus.UNSUCCESSFUL,
  },
  Query: {
    allSessions: (async (parent, args, context) => (await context.db.getSessions())) as FieldResolverFn,
    getSession: (async (parent, args, context) => (await getSessionIfAuthorized(args.sessionId, context))) as FieldResolverFn,
  },
  Mutation: {
    createSession: (async (parent, args, context) => {
      const ttl: DeletionDelay = DeletionDelay[args.input.ttl]
      authorizeDelay(context.currentUser, ttl)

      const update: Prisma.SessionCreateInput = {
        title: args.input.title,
        owners: [ context.currentUser.userId ],
        deletedAt: moment().add(ttl.delay, ttl.unit).toISOString(),
      }

      if (args.input.parentSession) {
        const parentSession = await getSessionIfAuthorized(args.input.parentSession, context)
        if (parentSession.parentSession) { throw Error('Provided parent session already is a child session.') }
        update.parentSession = parentSession.id
      }

      return await context.db.createSession(update)
    }) as FieldResolverFn,
    addParticipantsToSession: (async (parent, args, context) => {
      const session = await getSessionIfAuthorized(args.sessionId, context)
      if (session.owners.some(owner => args.userIds.includes(owner))) {
        throw new Error(`One or more of the users are already owners of this session.
         Demotions are handled in a separate mutation.`)
      }

      const futureParticipants = args.userIds.reduce((acc, it) => session.participants.includes(it)
        ? acc
        : [ ...acc, it ], [] as string[])

      if (futureParticipants.length > 0) {
        try {
          const payload = await context.db.addUsersAsParticipants(session, futureParticipants)
          console.log(payload)
          if (payload.nModified === 0) { throw Error('') }
        } catch (_e) {
          throw Error('Could not add users as participants of this session.')
        }

        session.updatedAt = moment().toDate()
        session.participants.push(...futureParticipants)
      }

      return session
    }) as FieldResolverFn,
    addOwnersToSession: (async (parent, args, context) => {
      const session = await getSessionIfAuthorized(args.sessionId, context)
      if (!session.owners.includes(context.currentUser.userId)) {
        throw new Error('User is not authorized to add an owner to this session.')
      }

      const futureOwners = args.userIds.reduce((acc, it) => session.owners.includes(it) ? acc : [ ...acc, it ], [] as string[])

      if (futureOwners.length > 0) {
        try {
          const payload = await context.db.addUsersAsOwners(session, futureOwners)
          if (payload.nModified === 0) { throw Error('') }
        } catch (e) {
          throw Error('Could not add users as owners of this session.')
        }

        session.updatedAt = moment().toDate()
        session.owners.push(...futureOwners)
        futureOwners.forEach(owner => {
          const participantIndex = session.participants.indexOf(owner)
          if (participantIndex !== -1) { session.participants.splice(participantIndex, 1) }
        })
      }

      return session
    }) as FieldResolverFn,
    joinSessionAsParticipant: (async (parent, args, context): Promise<Session> => {
      const session = await context.db.getSessionBy(args.sessionId)
      if (!session) { throw Error('Could not join session.') }
      if (session.owners.includes(context.currentUser.userId)) { throw new Error('User is already owner of this session.') }

      if (!session.participants.includes(context.currentUser.userId)) {
        try {
          const payload = await context.db.addUsersAsParticipants(session, [ context.currentUser.userId ])
          if (payload.nModified === 0) { throw Error('') }
        } catch (e) {
          throw Error('Could not add users as owners of this session.')
        }

        session.updatedAt = moment().toDate()
        session.participants.push(context.currentUser.userId)
      }
      return session
    }) as FieldResolverFn,
    joinSessionAsOwner: (async (parent, args, context): Promise<Session> => {
      const session = await context.db.getSession({ privateId: args.sessionId })
      if (!session) { throw Error('Could not join session.') }

      if (!session.owners.includes(context.currentUser.userId)) {
        try {
          const payload = await context.db.addUsersAsOwners(session, [ context.currentUser.userId ])
          if (payload.nModified === 0) { throw Error('') }
        } catch (e) {
          throw Error('Could not add users as owners of this session.')
        }

        session.updatedAt = moment().toDate()
        session.owners.push(context.currentUser.userId)
        const participantIndex = session.participants.indexOf(args.userId)
        if (participantIndex !== -1) { session.participants.splice(participantIndex, 1) }
      }
      return session
    }) as FieldResolverFn,
    prolongSession: (async (parent, args, context) => {
      const session = await getSessionIfAuthorized(args.sessionId, context)
      const ttl: DeletionDelay = DeletionDelay[args.ttl]
      authorizeDelay(context.currentUser, ttl)

      return await context.db.updateSession(
        { id: session.id },
        { deletedAt: moment(session.deletedAt).add(ttl.delay, ttl.unit).toISOString() },
      )
    }) as FieldResolverFn,
    deleteSession: (async (parent, args, context: Context) => {
      const session = await getSessionIfAuthorized(args.sessionId, context)
      if (!session.owners.includes(context.currentUser.userId)) {
        throw new Error('User is not authorized to delete this session.')
      }

      try {
        await context.db.deleteSession({ id: session.id })
        return { status: DeletionStatus.SUCCESSFUL }
      } catch (e) {
        return { status: DeletionStatus.UNSUCCESSFUL, message: e instanceof Error ? e.message : null }
      }
    }) as FieldResolverFn,
    removeUserFromSession: (async (parent, args, context: Context) => {
      const session = await getSessionIfAuthorized(args.sessionId, context)
      const participantIndex = session.participants.indexOf(args.userId)
      const ownerIndex = session.owners.indexOf(args.userId)

      if (!session.owners.includes(context.currentUser.userId)) {
        throw new Error('User is not authorized to remove a user from this session.')
      }

      try {
        if (ownerIndex < 0 && participantIndex < 0) { throw new Error('') }
        const payload = await context.db.removeUsersFromSession(session, [ args.userId ])
        if (payload.nModified === 0) { throw Error('') }
      } catch (e) {
        throw Error('Could not remove user from this session.')
      }

      session.updatedAt = moment().toDate()
      if (participantIndex >= 0) { session.participants.splice(participantIndex, 1) }
      if (ownerIndex >= 0) { session.owners.splice(ownerIndex, 1) }
      return session
    }) as FieldResolverFn,
    leaveSession: (async (parent, args, context: Context) => {
      const session = await getSessionIfAuthorized(args.sessionId, context)

      try {
        const payload = await context.db.removeUsersFromSession(session, [ context.currentUser.userId ])
        if (payload.nModified === 0) { throw Error('') }
        return { status: DeletionStatus.SUCCESSFUL }
      } catch (e) {
        return { status: DeletionStatus.UNSUCCESSFUL, message: 'Could not remove user from this session.' }
      }
    }) as FieldResolverFn,
    addSessionAsChild: (async (parent, args, context: Context) => {
      const parentSession = await getSessionIfAuthorized(args.parentSession, context)
      const childSession = await getSessionIfAuthorized(args.childSession, context)
      const user = context.currentUser.userId

      if (!parentSession.owners.includes(user) || !childSession.owners.includes(user)) {
        throw new Error('Provided parent session already is a child session.')
      }
      if (parentSession.parentSession) { throw new Error('Provided parent session already is a child session.') }

      const childUsers = [ ...childSession.owners, ...childSession.participants ]
        .filter(it => parentSession.owners.includes(it))

      try{
        const updateChild = context.db.createUpdateTransaction(
          { id: childSession.id },
          { parentSession: parentSession.id },
        )
        const updateParent = context.db.createAddUsersAsTransaction(parentSession, childUsers, 'participants')

        const payload = await context.db.runTransactions([ updateChild, updateParent ])

        verifySession(payload[0])
        verifyRawUpdatePayload(payload[1])
        if (payload[1].nModified === 0) { await context.db.updateSession(
          { id: childSession.id },
          { parentSession: childSession.parentSession },
        )
        }

        const missingInParent = childUsers.reduce(
          (acc, it) => parentSession.owners.includes(it) || parentSession.participants.includes(it)
            ? acc
            : [ ...acc, it ], [] as string[]
        )
        parentSession.participants.push(...missingInParent)
        return parentSession
      } catch (e) {
        throw e
      }
    }) as FieldResolverFn,
  },
  Session: {
    __resolveReference: depthLimitedReferenceResolver(
      async (session, context) => await context.db.getSessionBy(session.id),
    ),
    owners: (async (parent) => parent.owners.map(id => ({ id }))) as FieldResolverFn,
    participants: (async (parent) =>
      parent.participants.length > 0 ? parent.participants.map(id => ({ id })) : null
    ) as FieldResolverFn,
    childSessions: depthLimitedFieldResolver(async (parent, _args, context) => {
      const children = await context.db.getSessions({
        AND: [
          { parentSession: { not: null } },
          { parentSession: { not: undefined } },
          { parentSession: { not: '' } },
          { parentSession: parent.id },
        ],
      })
      return children && children.length > 0 ? children : null
    }),
    parentSession: depthLimitedFieldResolver(
      async (parent, _args, context) =>
        parent.parentSession ? await context.db.getSessionBy(parent.parentSession) : null
    ),
  },
  User: {
    sessions: depthLimitedFieldResolver(async (user, _args, context) => {
      if (context.currentUser.userId !== user.id) { return null }

      const found = await context.db.getSessions({
        OR: [
          { owners: { has: user.id } },
          { participants: { has: user.id } },
        ],
      })
      return found?.length && found.length > 0 ? found : null
    }),
  }
}
