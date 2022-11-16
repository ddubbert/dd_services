import { AccessTokenContent } from './AccessTokenContent'

export enum DelayUnit {
  SECONDS = 's',
  MINUTES = 'm',
  HOURS = 'h',
  DAYS = 'd',
  WEEKS = 'w',
  MONTHS = 'M',
  YEARS = 'y',
}

export enum TTL {
  X_LONG = 'X_LONG',
  LONG = 'LONG',
  MEDIUM = 'MEDIUM',
  SHORT = 'SHORT',
  X_SHORT = 'X_SHORT',
}

export class DeletionDelay {
  static readonly X_LONG = new DeletionDelay(6, DelayUnit.MONTHS)
  static readonly LONG = new DeletionDelay(1, DelayUnit.MONTHS)
  static readonly MEDIUM = new DeletionDelay(1, DelayUnit.WEEKS)
  static readonly SHORT = new DeletionDelay(120, DelayUnit.SECONDS)
  static readonly X_SHORT = new DeletionDelay(4, DelayUnit.HOURS)

  private constructor(
    readonly delay: number,
    readonly unit: DelayUnit,
  ) {}

  static getMatchingFor(ttl: TTL): DeletionDelay {
    switch (ttl) {
    case TTL.X_LONG: {
      return DeletionDelay.X_LONG
    }
    case TTL.LONG: {
      return DeletionDelay.LONG
    }
    case TTL.MEDIUM: {
      return DeletionDelay.MEDIUM
    }
    case TTL.SHORT: {
      return DeletionDelay.SHORT
    }
    case TTL.X_SHORT: {
      return DeletionDelay.X_SHORT
    }
    }
  }
}

export const getDelayIfAuthorized = (user: AccessTokenContent, ttl: TTL): DeletionDelay|never => {
  const delay = DeletionDelay.getMatchingFor(ttl)
  if (!user.isPermanent && (delay !== DeletionDelay.SHORT && delay !== DeletionDelay.X_SHORT)) {
    throw new Error('Non permanent users can only create short sessions.')
  }
  return delay
}
