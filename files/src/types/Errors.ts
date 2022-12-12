import { GraphQLError } from 'graphql'

export class TooManyRequestsError extends GraphQLError {
  constructor(message = 'Too many requests.') {
    super(message, { extensions: { code: 'TOO_MANY_REQUESTS' } })
  }
}

export class MaxDepthError extends GraphQLError {
  constructor(message = 'Max request depth exceeded.') {
    super(message, { extensions: { code: 'MAX_DEPTH_EXCEEDED' } })
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message = 'The requested resource could not be found.') {
    super(message, { extensions: { code: 'NOT_FOUND' } })
  }
}

export class BadRequestError extends GraphQLError {
  constructor(message = 'Malformed request or invalid input.') {
    super(message, { extensions: { code: 'BAD_REQUEST' } })
  }
}

export class InternalServerError extends GraphQLError {
  constructor(message = 'Something went wrong on the server. Please try again.') {
    super(message, { extensions: { code: 'INTERNAL_SERVER_ERROR' } })
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'User is not authorized to do this action.') {
    super(message, { extensions: { code: 'FORBIDDEN' } })
  }
}
