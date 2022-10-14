import moment from 'moment';
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const getSessionBy = async (id: string) => (await prisma.session.findFirst({ where: { id: id } }))

const getSessions = async (where: Prisma.SessionWhereInput = {}) => (await prisma.session.findMany({ where }))

const createSession = async (input: Prisma.SessionCreateInput) => {
  const data = {
    ...input,
    deletedAt: moment().add(12, 'h').toISOString()
  }

  return await prisma.session.create({ data })
}

const deleteSession = async (where: Prisma.SessionWhereUniqueInput) => (await prisma.session.delete({ where }))

const updateSession = async (where: Prisma.SessionWhereUniqueInput, input: Prisma.SessionUpdateInput) => {
  const data = { ...input, updatedAt: moment().toISOString() }

  return await prisma.session.update({
    where,
    data,
  })
}

export default {
  getSessionBy,
  getSessions,
  createSession,
  deleteSession,
  updateSession,
}
