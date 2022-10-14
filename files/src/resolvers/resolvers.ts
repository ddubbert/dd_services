import { GraphQLDateTime } from 'graphql-iso-date';
import moment from 'moment';
import db from '../models/database'
import { File, FileType } from '@prisma/client'

const emptyFile: File = {
  id: '0',
  name: 'Not Found',
  path: 'Not There',
  type: FileType.ERROR,
  description: 'No File was found',
  owner: '0',
  createdAt: moment().toISOString(),
  updatedAt: moment().toISOString(),
}

export default {
  DateTime: GraphQLDateTime,
  Query: {
    allFiles: async (parent, args, context) => (await db.getFiles()),
    fileUploadLink: async () => `http://${process.env.HOST}:${process.env.UPLOAD_PORT}/upload`
  },
  Mutation: {
    createFile: async (parent, args, context) => (await db.createFile(args.input))
  },
  File: {
    __resolveReference: async (file) => {
      return (await db.getFileBy(file.id)) ?? emptyFile;
    },
    owner:  async (parent, args, context) => ({ id: parent.owner })
  },
  User: {
    files: async (user) => {
      return await db.getFiles({ owner: user.id })
    }
  },
  FileType,
}
