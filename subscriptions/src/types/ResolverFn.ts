import { Context } from './Context'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql/type'
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue'
import { PubSubMessage } from './PubSubMessage'

export type FieldResolverFn = GraphQLFieldResolver<Record<string, any>, Context, Record<string, any>>

export type ReferenceResolverFn = GraphQLFieldResolver<Record<string, any>, GraphQLResolveInfo, Context>

export type SubscriptionSubscribeFn = GraphQLFieldResolver<
  Record<string, any>,
  Context,
  Record<string, any>,
  PromiseOrValue<AsyncIterator<any>>
>

export type SubscriptionResolveFn = GraphQLFieldResolver<
  PubSubMessage,
  Context,
  Record<string, any>
>
