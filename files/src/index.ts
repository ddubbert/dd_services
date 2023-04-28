require('dotenv').config()

import { startGraphQLServer } from './models/GraphQLServer'
import { addUploadListener } from './utils/UploadListener'
import createUserSessionDB from './models/UserSessionDatabase'
import EventHandler from './models/EventHandler'
import createAuthenticator from './models/Authenticator'
import createFileDB from './models/FileDatabase'
import createProcessors from './utils/EventMessageProcessorCreator'
import { createSigner } from './utils/URLSigner'
import { createUploadHandler } from './models/UploadHandler'
import { startExpressFileServer } from './models/ExpressFileServer';

(async (): Promise<void> => {
  const events = new EventHandler()
  const uploadHandler = createUploadHandler()
  const fileDB = await createFileDB(events, uploadHandler)
  const userSessionDB = await createUserSessionDB()
  const signer = createSigner()
  addUploadListener(uploadHandler, fileDB)
  const auth = createAuthenticator()
  createProcessors(events, fileDB, userSessionDB)
  await events.start()

  await startGraphQLServer(events, fileDB, userSessionDB, auth, signer, uploadHandler)
  await startExpressFileServer(fileDB, userSessionDB, auth, signer, uploadHandler)
})()
