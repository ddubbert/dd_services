import { UserDatabase } from '../models/database';
import { UserAuth } from './userAuth'
import { ExecutionContext } from 'graphql/execution/execute'
import { Authenticator } from '../models/authentication'
import {Maybe} from '@graphql-tools/utils'

export interface Context extends ExecutionContext {
  currentUser: Maybe<UserAuth>;
  db: UserDatabase;
  auth: Authenticator;
}
