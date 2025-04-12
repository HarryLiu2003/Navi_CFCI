import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client'; // Use named import for the client instance getter function

/**
 * Base class for repositories providing access to the Prisma client.
 */
export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;
  protected modelName: string; // Added for potential generic methods

  constructor(prisma?: PrismaClient, modelName?: string) {
    this.prisma = prisma || getPrismaClient(); // Call the function to get the client instance
    if (!modelName) {
        throw new Error("Model name must be provided to BaseRepository constructor");
    }
    this.modelName = modelName;
  }

  // Potential future shared methods like:
  // async findById(id: string): Promise<T | null> {
  //   return (this.prisma as any)[this.modelName].findUnique({ where: { id } });
  // }
  // async delete(id: string): Promise<T> {
  //   return (this.prisma as any)[this.modelName].delete({ where: { id } });
  // }
} 