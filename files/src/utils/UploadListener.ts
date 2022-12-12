import { UploadHandler, UploadSubscriberAction } from '../models/UploadHandler'
import { FileDatabase } from '../models/FileDatabase'
import { Prisma } from '@prisma/client'

export const addUploadListener = (uploadHandler: UploadHandler, fileDB: FileDatabase): void => {
  const saveFiles: UploadSubscriberAction = async (event): Promise<void> => {
    const createInputs: Prisma.FileCreateInput[] = event.uploads.map(it => ({
      localId: it.filename,
      name: it.originalname,
      type: it.mimetype,
      description: '',
      permanent: !event.session,
      owner: event.user.userId,
      creator: event.user.nickname,
      size: it.size,
      sessions: event.session ? [ event.session ] : [],
    }))

    await fileDB.createFiles(createInputs)

    const files = await fileDB.getFiles({ localId: { in: event.uploads.map(it => it.filename) } })
    if (files) {
      uploadHandler.acceptFiles(files.map(it => it.localId))
      if (files.length < event.uploads.length) {
        const notSaved = event.uploads.filter(upload => !files.some(it => it.localId === upload.filename))
        console.log(
          `Not all files could be saved. 
          Files with the names ${notSaved.reduce((acc, it) => acc += it.originalname + ', ', '')}`
        )
        uploadHandler.rejectFiles(notSaved)
      }
    } else { console.log('failed db entries') }
  }

  uploadHandler.subscribeUploads(saveFiles)
}
