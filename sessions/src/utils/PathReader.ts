import { FieldResolverFn, ReferenceResolverFn } from '../types/ResolverFn'
import { GraphQLResolveInfo } from 'graphql/type'

export const MAX_DEPTH = process.env.MAX_DEPTH ? parseInt(process.env.MAX_DEPTH, 10) : 5

export const getDepthFromInfo = (info: GraphQLResolveInfo): number => buildPathAsArray(info.path).length

export const buildPathAsArray = (path?: Record<string, any>, currentPath: string[] = []): string[] =>
  path ? buildPathAsArray(path.prev, [ ...currentPath, path.key ])
    : currentPath.filter(it => isNaN(parseInt(it, 10)))

export const depthLimitedFieldResolver = (fun: FieldResolverFn, maxDepth: number = MAX_DEPTH): FieldResolverFn =>
  async (parent, args, context, info) => {
    if (getDepthFromInfo(info) > maxDepth) {
      throw new Error('Maximum depth reached.')
    }
    return fun(parent, args, context, info)
  }

export const depthLimitedReferenceResolver = (fun: ReferenceResolverFn, maxDepth: number = MAX_DEPTH): ReferenceResolverFn =>
  async (reference, context, info) => {
    if (getDepthFromInfo(info) > maxDepth) {
      throw new Error('Maximum depth reached.')
    }
    return fun(reference, context, info)
  }
