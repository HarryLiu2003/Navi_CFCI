import { Interview, Prisma } from '@prisma/client'
import { getPrismaClient } from '../client'

/**
 * Repository class for handling Interview-related database operations.
 * Provides CRUD operations and query methods for Interview entities.
 */
export class InterviewRepository {
  private prisma = getPrismaClient()

  /**
   * Create a new interview record
   * @param data - The interview data to create
   * @returns Promise<Interview> - The created interview
   * @throws Error if creation fails
   */
  async create(data: Prisma.InterviewCreateInput): Promise<Interview> {
    try {
      return await this.prisma.interview.create({ data })
    } catch (error) {
      console.error('Error creating interview:', error)
      throw error
    }
  }

  /**
   * Find multiple interviews with pagination and sorting
   * @param params - Query parameters including pagination, filtering, and sorting
   * @returns Promise<Interview[]> - Array of interviews
   * @throws Error if query fails
   */
  async findMany(params: {
    skip?: number
    take?: number
    where?: Prisma.InterviewWhereInput
    orderBy?: Prisma.InterviewOrderByWithRelationInput
  }): Promise<Interview[]> {
    try {
      const { skip, take, where, orderBy } = params
      return await this.prisma.interview.findMany({
        skip,
        take,
        where,
        orderBy: orderBy || { created_at: 'desc' }
      })
    } catch (error) {
      console.error('Error finding interviews:', error)
      throw error
    }
  }

  /**
   * Find a single interview by ID
   * @param id - The interview ID
   * @returns Promise<Interview | null> - The found interview or null if not found
   * @throws Error if query fails
   */
  async findById(id: string): Promise<Interview | null> {
    try {
      return await this.prisma.interview.findUnique({
        where: { id }
      })
    } catch (error) {
      console.error(`Error finding interview by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Count total interviews (useful for pagination)
   * @param where - Optional filter conditions
   * @returns Promise<number> - Total count of interviews
   * @throws Error if count fails
   */
  async count(where?: Prisma.InterviewWhereInput): Promise<number> {
    try {
      return await this.prisma.interview.count({ where })
    } catch (error) {
      console.error('Error counting interviews:', error)
      throw error
    }
  }

  /**
   * Update an existing interview
   * @param id - The interview ID to update
   * @param data - The update data
   * @returns Promise<Interview> - The updated interview
   * @throws Error if update fails
   */
  async update(id: string, data: Prisma.InterviewUpdateInput): Promise<Interview> {
    try {
      return await this.prisma.interview.update({
        where: { id },
        data
      })
    } catch (error) {
      console.error(`Error updating interview ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete an interview by ID
   * @param id - The interview ID to delete
   * @returns Promise<Interview> - The deleted interview
   * @throws Error if deletion fails
   */
  async delete(id: string): Promise<Interview> {
    try {
      return await this.prisma.interview.delete({
        where: { id }
      })
    } catch (error) {
      console.error(`Error deleting interview ${id}:`, error)
      throw error
    }
  }
} 