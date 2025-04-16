import { Interview, Prisma, Project, Persona } from '@prisma/client'
import { getPrismaClient } from '../client'

// Helper types for nested creation
interface ExcerptData {
  quote: string;
  categories: string[];
  insight: string;
  chunk_number: number;
}

interface ProblemAreaData {
  title: string;
  description: string;
  excerpts: ExcerptData[];
}

/**
 * Prisma arguments validator for including full interview relations.
 * Defines the structure for fetching interviews with nested data.
 */
const interviewWithFullRelationsArgs = Prisma.validator<Prisma.InterviewDefaultArgs>()({
  include: {
    project: true,
    personas: true,
    problemAreas: {
      orderBy: { created_at: 'asc' },
      include: {
        excerpts: {
          orderBy: { chunk_number: 'asc' },
        },
      },
    },
  },
});

/**
 * Type definition for Interview including all relevant relations,
 * derived using Prisma.InterviewGetPayload.
 */
type InterviewWithFullRelations = Prisma.InterviewGetPayload<typeof interviewWithFullRelationsArgs>;

/**
 * Basic payload type for ProblemArea (if direct import fails)
 */
type ProblemAreaPayload = Prisma.ProblemAreaGetPayload<{}>;

/**
 * Repository class for handling Interview-related database operations.
 * Provides CRUD operations and query methods for Interview entities.
 */
export class InterviewRepository {
  private prisma = getPrismaClient()

  /**
   * Create a new interview record, optionally including nested Problem Areas and Excerpts
   * @param interviewData - Base interview data (Prisma.InterviewCreateInput)
   * @param problemAreasData - Optional array of problem area data with nested excerpts
   * @returns Promise<Interview> - The created interview (base record)
   * @throws Error if creation fails
   */
  async create(
    interviewData: Omit<Prisma.InterviewCreateInput, 'problemAreas'>,
    problemAreasData?: ProblemAreaData[]
  ): Promise<Interview> {
    try {
      if (!problemAreasData || problemAreasData.length === 0) {
        return await this.prisma.interview.create({ data: interviewData });
      }

      return await this.prisma.$transaction(async (tx) => {
        const newInterview = await tx.interview.create({ data: interviewData });

        for (const paData of problemAreasData) {
          // Access model via lowercase property on tx client
          const newProblemArea = await tx.problemArea.create({
            data: {
              interview_id: newInterview.id,
              title: paData.title,
              description: paData.description,
            },
          });

          if (paData.excerpts && paData.excerpts.length > 0) {
            // Access model via lowercase property on tx client
            await tx.excerpt.createMany({
              data: paData.excerpts.map((exData) => ({
                problem_area_id: newProblemArea.id,
                ...exData, // Spread remaining fields
              })),
            });
          }
        }
        return newInterview;
      });
    } catch (error) {
      console.error('Error creating interview with problem areas:', error);
      throw error;
    }
  }

  /**
   * Find multiple interviews with basic fields (no relations by default).
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
      const queryOptions: Prisma.InterviewFindManyArgs = {
        skip,
        take,
        where,
        orderBy: orderBy || { created_at: 'desc' },
        select, // Pass select if provided
      };
      // No default include
      return await this.prisma.interview.findMany(queryOptions);
    } catch (error) {
      console.error('Error finding interviews:', error)
      throw error
    }
  }

  /**
   * Find a single interview by ID (no relations).
   */
  async findById(id: string): Promise<Interview | null> {
    try {
      return await this.prisma.interview.findUnique({ where: { id } })
    } catch (error) {
      console.error(`Error finding interview by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Count interviews.
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
   * Update base Interview fields.
   */
  async update(id: string, data: Prisma.InterviewUpdateInput): Promise<Interview> {
    try {
      return await this.prisma.interview.update({ where: { id }, data })
    } catch (error) {
      console.error(`Error updating interview ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete an Interview (cascades to ProblemAreas/Excerpts).
   */
  async delete(id: string): Promise<Interview> {
    try {
      return await this.prisma.interview.delete({ where: { id } })
    } catch (error) {
      console.error(`Error deleting interview ${id}:`, error)
      throw error
    }
  }

  /**
   * Find a single interview by ID, including all nested relations.
   */
  async findByIdWithRelations(id: string): Promise<InterviewWithFullRelations | null> {
    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id },
        ...interviewWithFullRelationsArgs, // Use the validated include structure
      });
      // Type assertion might still be needed if inference isn't perfect
      return interview as InterviewWithFullRelations | null;
    } catch (error) {
      console.error(`Error finding interview by ID ${id} with full relations:`, error);
      throw error;
    }
  }

  /**
   * Find multiple interviews with all nested relations.
   */
   async findManyWithRelations(params: {
    skip?: number;
    take?: number;
    where?: Prisma.InterviewWhereInput;
    orderBy?: Prisma.InterviewOrderByWithRelationInput;
  }): Promise<InterviewWithFullRelations[]> {
    try {
      const { skip, take, where, orderBy } = params;
      const interviews = await this.prisma.interview.findMany({
        skip,
        take,
        where,
        orderBy: orderBy || { created_at: 'desc' },
        ...interviewWithFullRelationsArgs, // Use the validated include structure
      });
      // Type assertion might still be needed
      return interviews as InterviewWithFullRelations[];
    } catch (error) {
      console.error('Error finding interviews with full relations:', error);
      throw error;
    }
  }

  /**
   * Update base Interview fields and fetch with Project/Persona relations.
   * Note: Does NOT include ProblemArea/Excerpt relations.
   */
  async updateAndFetch(id: string, data: Prisma.InterviewUpdateInput): Promise<(Interview & { project: Project | null; personas: Persona[] })> {
    try {
      const updatedInterview = await this.prisma.interview.update({
        where: { id },
        data,
        include: { project: true, personas: true }, // Only includes these relations
      });
      if (!updatedInterview) {
        throw new Error(`Interview with ID ${id} not found after update.`);
      }
      return updatedInterview;
    } catch (error) {
      console.error(`Error updating and fetching interview ${id}:`, error);
      throw error;
    }
  }

  // --- NEW METHODS for ProblemArea --- 

  /**
   * Update specific fields of a ProblemArea and return it with excerpts.
   * @param problemAreaId - The UUID of the ProblemArea to update
   * @param data - Data to update (must be Prisma.ProblemAreaUpdateInput)
   * @returns Promise<ProblemAreaPayload & { excerpts: Excerpt[] }> - The updated ProblemArea with excerpts
   * @throws Error if update fails
   */
  async updateProblemArea(
      problemAreaId: string, 
      data: Prisma.ProblemAreaUpdateInput
  ): Promise<Prisma.ProblemAreaGetPayload<{ include: { excerpts: true } }>> {
    try {
      // Use lowercase model name: this.prisma.problemArea
      return await this.prisma.problemArea.update({
        where: { id: problemAreaId },
        data,
        include: { excerpts: true }
      });
    } catch (error) {
      console.error(`Error updating ProblemArea ${problemAreaId}:`, error);
      throw error;
    }
  }

  /**
   * Update the is_confirmed status and optionally the priority of a ProblemArea.
   * @param problemAreaId - The UUID of the ProblemArea
   * @param isConfirmed - The new confirmation status
   * @param priority - The new priority (L, M, S) or null to clear it.
   * @returns Promise<ProblemAreaPayload & { excerpts: Excerpt[] }> - The updated ProblemArea with excerpts
   * @throws Error if update fails
   */
  async confirmProblemArea(
      problemAreaId: string, 
      isConfirmed: boolean,
      priority?: string | null // Added optional priority parameter
  ): Promise<Prisma.ProblemAreaGetPayload<{ include: { excerpts: true } }>> { 
    try {
      // Prepare data, including priority if provided (setting to null if undefined/null passed)
      const dataToUpdate: Prisma.ProblemAreaUpdateInput = {
          is_confirmed: isConfirmed,
          priority: priority === undefined ? null : priority // Set to null if undefined/null
      };
      
      // If unconfirming, always clear the priority
      if (!isConfirmed) {
          dataToUpdate.priority = null;
      }

      return await this.prisma.problemArea.update({
        where: { id: problemAreaId },
        data: dataToUpdate,
        include: { excerpts: true } // Include excerpts in the response
      });
    } catch (error) {
      console.error(`Error confirming ProblemArea ${problemAreaId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a ProblemArea by its UUID.
   * Related Excerpts will be cascade deleted. Returns the deleted record WITHOUT excerpts.
   * @param problemAreaId - The UUID of the ProblemArea to delete
   * @returns Promise<ProblemAreaPayload> - The deleted ProblemArea record
   * @throws Error if deletion fails
   */
  async deleteProblemArea(problemAreaId: string): Promise<Prisma.ProblemAreaGetPayload<{}>> {
    try {
      // Use lowercase model name: this.prisma.problemArea
      return await this.prisma.problemArea.delete({
        where: { id: problemAreaId },
      });
    } catch (error) {
      console.error(`Error deleting ProblemArea ${problemAreaId}:`, error);
      throw error;
    }
  }
} 