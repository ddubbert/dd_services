import { Prisma } from '@prisma/client'

export type SessionUniqueUpdate = { where: Prisma.SessionWhereUniqueInput, data: Prisma.SessionUpdateInput }

export type SessionUpdate = { where: Prisma.SessionWhereInput, data: Prisma.SessionUpdateInput }
