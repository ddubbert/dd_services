import { Context } from './Context'
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql/type'

export type FieldResolverFn = GraphQLFieldResolver<Record<string, any>, Context, Record<string, any>>

export type ReferenceResolverFn = GraphQLFieldResolver<Record<string, any>, GraphQLResolveInfo, Context>
