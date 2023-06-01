import * as fs from 'fs'
import { AccessTokenContent } from '../types/AccessTokenContent'
import { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue'
import { FILE_FOLDER, FILE_TEMP_FOLDER } from '../types/FilePath'
import { v4 } from 'uuid'
import { NotFoundError } from '../types/Errors'

export type UploadEvent = {
  uploads: Express.Multer.File[]
  user: AccessTokenContent
  session?: string
}
export type UploadSubscriberAction = (event: UploadEvent) => PromiseOrValue<void>

export interface UploadHandler {
  subscribeUploads: (action: UploadSubscriberAction) => void
  publishUploads: (event: UploadEvent) => Promise<void>
  acceptFiles: (ids: string[]) => void
  rejectFiles: (files: Express.Multer.File[]) => void
  deleteFiles: (ids: string[]) => void
  copyFile: (id: string) => string|never
}

export const createUploadHandler = (): UploadHandler => {
  const subscribers: UploadSubscriberAction[] = []
  if (!fs.existsSync(`${FILE_TEMP_FOLDER}`)) {
    fs.mkdirSync(`${FILE_TEMP_FOLDER}`)
  }
  if (!fs.existsSync(`${FILE_FOLDER}`)) {
    fs.mkdirSync(`${FILE_FOLDER}`)
  }

  const subscribeUploads = (action: UploadSubscriberAction): void => {
    subscribers.push(action)
  }

  const publishUploads = async (event: UploadEvent): Promise<void> => {
    await Promise.all(subscribers.map(it => it(event)))
  }

  const acceptFiles = (ids: string[]): void => {
    ids.forEach(it => {
      if (fs.existsSync(`${FILE_TEMP_FOLDER}/${it}`)) {
        fs.renameSync(`${FILE_TEMP_FOLDER}/${it}`, `${FILE_FOLDER}/${it}`)
      }
    })
  }

  const rejectFiles = (files: Express.Multer.File[]): void => {
    files.forEach(it => {
      if (fs.existsSync(it.path)) {
        fs.unlinkSync(it.path)
      }
    })
  }

  const deleteFiles = (ids: string[]): void => {
    ids.forEach(it => {
      const path = `${FILE_FOLDER}/${it}`
      if (fs.existsSync(path)) {
        fs.unlinkSync(path)
        if (!fs.existsSync(path)) { console.log(`File deleted: ${it}`) }
      }
    })
  }

  const copyFile = (id: string): string|never => {
    const newId = v4()
    const path = `${FILE_FOLDER}/${id}`
    if (fs.existsSync(path)) {
      fs.copyFileSync(`${FILE_FOLDER}/${id}`, `${FILE_FOLDER}/${newId}`)
      return newId
    }
    throw new NotFoundError('File not found.')
  }

  return { subscribeUploads, publishUploads, acceptFiles, rejectFiles, deleteFiles, copyFile }
}
