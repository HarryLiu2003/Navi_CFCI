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
        ...args, // Spread existing args (where, take, skip, orderBy)
        select: { // Use select to explicitly choose fields and relations/counts
          id: true,
          name: true,
          description: true,
          ownerId: true,
          updatedAt: true, // Include the new updatedAt field
          owner: { // Include the related owner
            select: {
              name: true, // Only select the name field from the owner
            }
          },
          _count: { // Include a count of related interviews
            select: {
              interviews: { // Count interviews...
                where: {
                  created_at: { // ...where the creation date...
                    gte: oneMonthAgo, // ...is greater than or equal to one month ago
                  }
                }
              }
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
   * Update an existing project
   * @param id - The project ID to update
   * @param data - The update data (e.g., { updatedAt: new Date() })
   * @returns Promise<Project> - The updated project
   * @throws Error if update fails
   */
  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    try {
      return await this.prisma.project.update({
        where: { id },
        data
      });
    } catch (error) {
      console.error(`Error updating project ${id}:`, error);
      // Consider specific error handling, e.g., P2025 for record not found
      throw error;
    }
  }

  /**
   * Delete a project by ID
   * @param id - The project ID to delete
   * @returns Promise<Project> - The deleted project
   * @throws Error if deletion fails
   */
  async delete(id: string): Promise<Project> {
    try {
      // Potential: Add checks here if needed before deleting
      return await this.prisma.project.delete({
        where: { id }
      });
    } catch (error) {
      console.error(`Error deleting project ${id}:`, error);
      // Consider specific error handling, e.g., P2025 for record not found
      throw error;
    }
  }

  // --- Add other methods (findById, update, delete) as needed later ---
} 