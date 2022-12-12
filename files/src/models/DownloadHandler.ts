import { Response } from 'express'
import { File } from '@prisma/client'
import * as fs from 'fs'
import { FILE_FOLDER } from '../types/FilePath'
import { InternalServerError, NotFoundError } from '../types/Errors'
import JSZip from 'jszip'

export interface DownloadHandler {
  downloadFile: (res: Response, file: File) => Promise<void>
  downloadFiles: (res: Response, files: File[], folderName: string) => Promise<void>
}

export const createDownloadHandler = (): DownloadHandler => {
  const downloadFile = async (res: Response, file: File): Promise<void> => {
    const path = `${FILE_FOLDER}/${file.localId}`
    if (!fs.existsSync(path)) { throw new NotFoundError('File not found.') }
    res.setHeader('Content-Type', file.type)
    res.setHeader('Content-Disposition', 'attachment; filename=' + file.name)
    res.setHeader('Content-Transfer-Encoding', 'binary')
    res.sendFile(path)
  }

  const downloadFiles = async (res: Response, files: File[], folderName: string): Promise<void> => {
    const zip = new JSZip()
    const folder = zip.folder(folderName)
    if (!folder) { throw new InternalServerError('Something went wrong creating the zip file.') }
    for (const file of files) {
      const data = fs.readFileSync(`${FILE_FOLDER}/${file.localId}`)
      folder.file(file.name, data)
    }
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename=' + folderName + '.zip')
    res.setHeader('Content-Transfer-Encoding', 'binary')
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(res)
      .on('finish', (): void => {
        console.log('Downloaded zip successfully.')
      })
  }

  return {
    downloadFile,
    downloadFiles,
  } as DownloadHandler
}
