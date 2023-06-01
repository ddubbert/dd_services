import { GraphQLError } from 'graphql'
import { FileUploadRequest } from './FileUploadRequest'

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

export class FileSizeError extends GraphQLError {
  constructor(max: number, file: FileUploadRequest) {
    super(
      `File "${file.name}" has ${file.size} bytes but only a max of ${max} bytes is allowed per file.`,
      { extensions: { code: 'FILE_SIZE_ERROR' } },
    )
  }
}

export class FileSizeMismatchError extends GraphQLError {
  constructor(requestedSize: number, file: FileUploadRequest) {
    super(
      `File "${file.name}" has ${file.size} bytes but ${requestedSize} bytes have been previously requested. Request failed.`,
      { extensions: { code: 'FILE_SIZE_MISMATCH_ERROR' } },
    )
  }
}

export class FileAmountError extends GraphQLError {
  constructor(max: number, amount: number) {
    super(
      `Only ${max} files can be uploaded at a time but ${amount} were provided.`,
      { extensions: { code: 'FILE_AMOUNT_ERROR' } },
    )
  }
}

export class UploadSpaceError extends GraphQLError {
  constructor(remainingSpace: number, requestedSpace: number) {
    super(
      `Not enough upload space. Only ${remainingSpace} bytes remaining but ${requestedSpace} where requested.`,
      { extensions: { code: 'UPLOAD_SPACE_ERROR' } },
    )
  }
}
