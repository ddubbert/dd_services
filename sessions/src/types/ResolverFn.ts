import { Context } from './Context'
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue'
import { GraphQLResolveInfo } from 'graphql/type'

export type FieldResolverFn = (parent: Record<string, any>,
  args: Record<string, any>,
  context: Context,
  info: GraphQLResolveInfo) => PromiseOrValue<any>

export type ReferenceResolverFn = (reference: Record<string, any>,
  context: Context,
  info: GraphQLResolveInfo) => PromiseOrValue<any>
