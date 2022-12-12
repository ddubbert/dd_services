import { FileType } from './FileType'

type FileFilterOptions = {
  permanent: boolean
  creator: string
  type: FileType
}

export type FileFilter = Partial<FileFilterOptions> | undefined | null
