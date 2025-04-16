import { PrismaClient, Project, Prisma } from '@prisma/client';
import { getPrismaClient } from '../client'; // Use named import

// Helper to get the date one month ago
function getOneMonthAgo(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date;
}

export class ProjectRepository {
  private prisma = getPrismaClient(); // Initialize directly

  /**
   * Creates a new project.
   * @param data - The data for the new project, conforming to Prisma.ProjectCreateInput.
   * @returns The created project.
   */
  // Use Prisma.ProjectCreateInput for data type hint
  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    try {
      // Check if the owner exists before attempting to create
      if (data.owner && data.owner.connect && data.owner.connect.id) {
        const ownerExists = await this.prisma.user.findUnique({
          where: { id: data.owner.connect.id },
        });
        if (!ownerExists) {
          throw new Error(`Related owner user not found with ID: ${data.owner.connect.id}`);
        }
      }
      return await this.prisma.project.create({ data });
    } catch (error) {
      console.error('Error creating project in repository:', error);
      // Re-throw for specific handling in the API layer
      throw error;
    }
  }

  /**
   * Finds multiple projects based on query parameters.
   * Includes owner name and count of interviews in the last month.
   * @param args - Prisma query arguments (where, take, skip, orderBy).
   * @returns A list of projects with included owner and interview count.
   */
  async findMany(args: {
    where?: Prisma.ProjectWhereInput;
    take?: number;
    skip?: number;
    orderBy?: Prisma.ProjectOrderByWithRelationInput | Prisma.ProjectOrderByWithRelationInput[];
  }): Promise<any[]> { // Return type might need adjustment based on what Prisma returns with includes/counts
    try {
      const oneMonthAgo = getOneMonthAgo();
      
      return await this.prisma.project.findMany({
        ...args, // Spread existing args (where, take, skip)
        select: { // Use select to explicitly choose fields and relations/counts
          id: true,
          name: true,
          description: true,
          ownerId: true,
          updatedAt: true, // Keep updatedAt for fallback sorting
          owner: { 
            select: {
              name: true, 
            }
          },
          _count: { 
            select: {
              interviews: { 
                where: {
                  created_at: {
                    gte: oneMonthAgo 
                  }
                }
              }
            }
          },
          interviews: { // Get latest interview for sorting key
            orderBy: {
              created_at: 'desc'
            },
            take: 1,
            select: {
              created_at: true 
            }
          }
        }
      });
    } catch (error) {
      console.error('Error finding multiple projects:', error);
      throw new Error('Failed to retrieve projects from repository');
    }
  }

  /**
   * Counts projects based on a where clause.
   * @param args - Prisma count arguments (where).
   * @returns The number of matching projects.
   */
  async count(args: {
    where?: Prisma.ProjectWhereInput;
  }): Promise<number> {
    try {
      return await this.prisma.project.count(args);
    } catch (error) {
      console.error('Error counting projects:', error);
      throw new Error('Failed to count projects in repository');
    }
  }

  /**
   * Find a single project by ID
   * @param id - The project ID
   * @returns Promise<Project | null> - The found project or null
   */
  async findById(id: string): Promise<Project | null> {
    try {
      return await this.prisma.project.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { interviews: true } },
        }
      });
    } catch (error) {
      console.error(`Error finding project by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing project after verifying ownership.
   * @param id - The project ID to update
   * @param ownerId - The ID of the user requesting the update (for authorization).
   * @param data - The update data (e.g., { name: 'new name', description: 'new desc' }).
   * @returns Promise<Project> - The updated project.
   * @throws Error if project not found, user not authorized, or update fails.
   */
  async update(id: string, ownerId: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    try {
      // Verify ownership before updating
      const project = await this.prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        throw new Error(`Project not found with ID: ${id}`); // Use a specific error type or code if preferred
      }

      if (project.ownerId !== ownerId) {
        throw new Error(`User ${ownerId} is not authorized to update project ${id}`); // Use a specific error type or code if preferred
      }

      // Proceed with the update if authorized
      return await this.prisma.project.update({
        where: { id }, // Use the validated ID
        data
      });
    } catch (error) {
      console.error(`Error updating project ${id} for user ${ownerId}:`, error);
      // Re-throw or handle specific Prisma errors (e.g., P2025)
      throw error;
    }
  }

  /**
   * Delete a project by ID after verifying ownership.
   * @param id - The project ID to delete.
   * @param ownerId - The ID of the user requesting the deletion (for authorization).
   * @returns Promise<Project> - The deleted project.
   * @throws Error if project not found, user not authorized, or deletion fails.
   */
  async delete(id: string, ownerId: string): Promise<Project> {
    try {
      // Verify ownership before deleting
       const project = await this.prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        throw new Error(`Project not found with ID: ${id}`); // Use a specific error type or code if preferred
      }

      if (project.ownerId !== ownerId) {
        throw new Error(`User ${ownerId} is not authorized to delete project ${id}`); // Use a specific error type or code if preferred
      }
      
      // Proceed with deletion if authorized
      // Potential: Add checks here if needed before deleting (e.g., check for associated interviews?)
      return await this.prisma.project.delete({
        where: { id } // Use the validated ID
      });
    } catch (error) {
      console.error(`Error deleting project ${id} for user ${ownerId}:`, error);
      // Re-throw or handle specific Prisma errors (e.g., P2025, foreign key constraints)
      throw error;
    }
  }

  // --- Add other methods (findById, update, delete) as needed later ---
} 