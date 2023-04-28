import { Context } from './Context'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql/type'
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue'
import { ResolverFn } from 'graphql-subscriptions'

export type FieldResolverFn = GraphQLFieldResolver<Record<string, any>, Context, Record<string, any>>

export type ReferenceResolverFn = GraphQLFieldResolver<Record<string, any>, GraphQLResolveInfo, Context>

export type SubscriptionResolverFn = GraphQLFieldResolver<
  Record<string, any>,
  Context,
  Record<string, any>,
  PromiseOrValue<ResolverFn>
>
