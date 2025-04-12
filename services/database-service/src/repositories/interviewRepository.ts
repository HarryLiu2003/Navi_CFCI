import { Interview, Prisma, Project, Persona } from '@prisma/client'
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
   * Find multiple interviews with pagination, sorting, and selection
   * @param params - Query parameters including pagination, filtering, sorting, and selection
   * @returns Promise<Interview[]> - Array of interviews (or partial interviews if select is used)
   * @throws Error if query fails
   */
  async findMany(params: {
    skip?: number
    take?: number
    where?: Prisma.InterviewWhereInput
    orderBy?: Prisma.InterviewOrderByWithRelationInput
    select?: Prisma.InterviewSelect
  }): Promise<Partial<Interview>[]> {
    try {
      const { skip, take, where, orderBy, select } = params
      
      // Determine query options based on whether select is provided
      const queryOptions: Prisma.InterviewFindManyArgs = {
        skip,
        take,
        where,
        orderBy: orderBy || { created_at: 'desc' },
      };

      if (select) {
        queryOptions.select = select;
      } else {
        queryOptions.include = { project: true };
      }
        
      // Pass the constructed options object
      return await this.prisma.interview.findMany(queryOptions);

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

  /**
   * Find a single interview by ID, including project and personas relations.
   * @param id - The interview ID
   * @returns Promise<Interview | null> - The found interview with relations or null if not found
   * @throws Error if query fails
   */
  async findByIdWithRelations(id: string): Promise<(Interview & { project: Project | null; personas: Persona[] }) | null> {
    try {
      return await this.prisma.interview.findUnique({
        where: { id },
        include: { project: true, personas: true },
      });
    } catch (error) {
      console.error(`Error finding interview by ID ${id} with relations:`, error);
      throw error;
    }
  }

  /**
   * Find multiple interviews with pagination, sorting, and selection, including relations.
   * @param params - Query parameters including pagination, filtering, and sorting
   * @returns Promise<Interview[]> - Array of interviews with relations
   * @throws Error if query fails
   */
   async findManyWithRelations(params: {
    skip?: number;
    take?: number;
    where?: Prisma.InterviewWhereInput;
    orderBy?: Prisma.InterviewOrderByWithRelationInput;
  }): Promise<(Interview & { project: Project | null; personas: Persona[] })[]> {
    try {
      const { skip, take, where, orderBy } = params;
      return await this.prisma.interview.findMany({
        skip,
        take,
        where,
        orderBy: orderBy || { created_at: 'desc' },
        include: { project: true, personas: true },
      });
    } catch (error) {
      console.error('Error finding interviews with relations:', error);
      throw error;
    }
  }

  /**
   * Update an existing interview and return the updated record with relations.
   * @param id - The interview ID to update
   * @param data - The update data
   * @returns Promise<Interview> - The updated interview with project and personas
   * @throws Error if update fails or record not found post-update
   */
  async updateAndFetch(id: string, data: Prisma.InterviewUpdateInput): Promise<(Interview & { project: Project | null; personas: Persona[] })> {
    try {
      const updatedInterview = await this.prisma.interview.update({
        where: { id },
        data,
        include: { project: true, personas: true }, // Include relations
      });
      if (!updatedInterview) {
        // This case might be less likely with Prisma update throwing P2025 on not found
        throw new Error(`Interview with ID ${id} not found after update.`);
      }
      return updatedInterview;
    } catch (error) {
      console.error(`Error updating and fetching interview ${id}:`, error);
      // Re-throw specific Prisma errors if needed (e.g., P2025 Record to update not found)
      throw error;
    }
  }
} 