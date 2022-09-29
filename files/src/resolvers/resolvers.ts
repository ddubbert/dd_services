type File = {
  id: string;
  name: string;
  description?: string | null;
  path: string;
  type: FileType;
  owner?: User;
}

type User = {
  id: string;
}

enum FileType {
  TEXT = 'txt',
  IMAGE = 'mg',
  AUDIO = 'wav',
  PDF = 'pdf',
  ERROR = 'error'
}

const files: Array<File> = [
  {
    id: '1',
    name: 'test1',
    description: 'toller text',
    path: `http://localhost:${process.env.PORT}/static/files/1.jpeg`,
    type: FileType.IMAGE,
    owner: { id: '1' }
  },
  {
    id: '2',
    name: 'test2',
    path: `http://localhost:${process.env.PORT}/static/files/2.jpg`,
    type: FileType.IMAGE,
    owner: { id: '1' }
  },
  {
    id: '3',
    name: 'image',
    description: 'tolles image',
    path: `http://localhost:${process.env.PORT}/static/files/3.png`,
    type: FileType.IMAGE,
    owner: { id: '2' }
  }
]

const emptyFile: File = {
  id: '0',
  name: 'Not Found',
  path: 'Not There',
  type: FileType.ERROR
}

export default {
  Query: {
    allFiles: async (parent, args, context) => (files),
    fileUploadLink: async () => `http://localhost:${process.env.PORT}/upload`
  },
  File: {
    __resolveReference(file){
      return files.find(f => f.id === file.id) ?? emptyFile;
    }
  },
  User: {
    files: async (user) => {
      return files.filter(f => f.owner && f.owner.id === user.id)
    }
  },
  FileType,
}
