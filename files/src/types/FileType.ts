export enum FileType {
  TEXT = 'text/',
  IMAGE = 'image/',
  AUDIO = 'audio/',
  PDF = 'application/pdf',
  ERROR = 'error'
}

const validMimeTypes = Object.values(FileType)
const fileTypeKeys = Object.keys(FileType)

export const getFileTypeFrom = (mimeType: string): FileType => validMimeTypes.reduce((acc, it, i) =>
  mimeType.startsWith(it) ? FileType[fileTypeKeys[i]] : acc
, FileType.ERROR)

export const fileTypeIsValid = (mimeType: string): boolean => validMimeTypes.some(it => mimeType.startsWith(it))
