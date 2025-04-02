import { Interview, Prisma } from '@prisma/client'
import { getPrismaClient } from '../client'

export class InterviewRepository {
  private prisma = getPrismaClient()

  /**
   * Create a new interview record
   */
  async create(data: Prisma.InterviewCreateInput): Promise<Interview> {
    return this.prisma.interview.create({ data })
  }

  /**
   * Find multiple interviews with pagination and sorting
   */
  async findMany(params: {
    skip?: number
    take?: number
    where?: Prisma.InterviewWhereInput
    orderBy?: Prisma.InterviewOrderByWithRelationInput
  }): Promise<Interview[]> {
    const { skip, take, where, orderBy } = params
    return this.prisma.interview.findMany({
      skip,
      take,
      where,
      orderBy: orderBy || { created_at: 'desc' }
    })
  }

  /**
   * Find a single interview by ID
   */
  async findById(id: string): Promise<Interview | null> {
    return this.prisma.interview.findUnique({
      where: { id }
    })
  }

  /**
   * Count total interviews (useful for pagination)
   */
  async count(where?: Prisma.InterviewWhereInput): Promise<number> {
    return this.prisma.interview.count({ where })
  }

  /**
   * Update an existing interview
   */
  async update(id: string, data: Prisma.InterviewUpdateInput): Promise<Interview> {
    return this.prisma.interview.update({
      where: { id },
      data
    })
  }

  /**
   * Delete an interview by ID
   */
  async delete(id: string): Promise<Interview> {
    return this.prisma.interview.delete({
      where: { id }
    })
  }
} 