import moment from 'moment';
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const getFileBy = async (id: string) => (await prisma.file.findFirst({ where: { id: id } }))

const getFiles = async (where: Prisma.FileWhereInput = {}) => (await prisma.file.findMany({ where }))

const createFile = async (input: Prisma.FileCreateInput) => {
  const data = {
    ...input,
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString(),
  }

  return await prisma.file.create({ data })
}

const deleteFile = async (where: Prisma.FileWhereUniqueInput) => (await prisma.file.delete({ where }))

const updateFile = async (where: Prisma.FileWhereUniqueInput, input: Prisma.FileUpdateInput) => {
  const data = { ...input, updatedAt: moment().toISOString() }

  return await prisma.file.update({
    where,
    data,
  })
}

export default {
  getFileBy,
  getFiles,
  createFile,
  deleteFile,
  updateFile,
}
