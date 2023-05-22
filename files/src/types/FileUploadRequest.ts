export interface FileUploadRequest {
  name: string
  mimetype: string
  size: number
  description?: string
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyFileUploadRequest(data: unknown): asserts data is FileUploadRequest {
  if (!(data instanceof Object)) {
    throw new Error('Decoded FileUploadRequest error. FileUploadRequest must be an object')
  }
  if (!('name' in data)) {
    throw new Error('Decoded FileUploadRequest error. Missing required field "name"')
  }
  if (!('size' in data)) {
    throw new Error('Decoded FileUploadRequest error. Missing required field "size"')
  }
  if (!('mimetype' in data)) {
    throw new Error('Decoded FileUploadRequest error. Missing required field "mimetype"')
  }
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function verifyFileUploadRequestArray(data: Array<unknown>): asserts data is FileUploadRequest[] {
  data.forEach(it => verifyFileUploadRequest(it))
}
