import { PrismaClient, Persona } from '@prisma/client';
import { BaseRepository } from './baseRepository';
// Correct path for utils
// import { cn } from '../lib/utils'; 

// --- Persona Color Logic (Removed) ---

// 1. Define the color palette (using Tailwind classes)
// const personaColors = [
//   { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
//   { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
//   { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
//   { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
//   { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
//   { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
//   { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
//   { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
//   { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
//   { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
// ];

// 2. Simple Hashing Function
// function simpleHash(str: string): number {
//   let hash = 0;
//   for (let i = 0; i < str.length; i++) {
//     const char = str.charCodeAt(i);
//     hash = (hash << 5) - hash + char;
//     hash |= 0; 
//   }
//   return Math.abs(hash);
// }

// 3. Utility function to get color classes string
// function getPersonaColorClassesString(personaName: string): string {
//   if (!personaName) {
//     const { bg, text, border } = personaColors[personaColors.length - 1]; // Use gray
//     return cn(bg, text, border);
//   }
//   const hash = simpleHash(personaName);
//   const colorIndex = hash % personaColors.length;
//   const { bg, text, border } = personaColors[colorIndex];
//   return cn(bg, text, border);
// }
// --- End Persona Color Logic ---

export class PersonaRepository extends BaseRepository<Persona> {
  constructor(prisma?: PrismaClient) {
    super(prisma, 'persona');
  }

  /**
   * Finds all personas belonging to a specific user.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to an array of Persona objects.
   */
  async findManyByUserId(userId: string): Promise<Persona[]> {
    if (!userId) {
        throw new Error("User ID must be provided to fetch personas.");
    }
    return this.prisma.persona.findMany({
      where: { userId },
      orderBy: { name: 'asc' }, // Order alphabetically by name
    });
  }

  /**
   * Creates a new persona for a user.
   * Ensures the persona name is unique for the user.
   * (Color is now optional and handled by the frontend)
   * @param userId - The ID of the user creating the persona.
   * @param name - The name of the new persona.
   * @param color - The color identifier (e.g., "blue") chosen by the user.
   * @returns A promise that resolves to the created Persona object.
   * @throws Error if name/userId/color is missing, user not found, or name is duplicate for user.
   */
  async createForUser(userId: string, name: string, color: string): Promise<Persona> {
    const trimmedName = name?.trim();
    const trimmedColor = color?.trim();

    if (!userId || !trimmedName || !trimmedColor) {
        throw new Error("User ID, a non-empty Persona name, and a color identifier are required.");
    }

    // Basic validation for color identifier (optional, can be expanded)
    // Example: if (!['blue', 'green', 'red', ...].includes(trimmedColor)) { throw new Error("Invalid color identifier"); }

    try {
        const newPersona = await this.prisma.persona.create({
            data: {
                name: trimmedName,
                color: trimmedColor, // Save the provided color identifier
                user: {
                    connect: { id: userId },
                },
            },
        });
        console.log(`[PersonaRepo] Created persona '${trimmedName}' for user ${userId} with color '${trimmedColor}'`);
        return newPersona;
    } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('userId') && error.meta?.target?.includes('name')) {
            console.warn(`[PersonaRepo] Persona '${trimmedName}' already exists for user ${userId}.`);
            throw new Error(`Persona with name "${trimmedName}" already exists for this user.`);
        } 
        else if (error.code === 'P2025') {
            console.error(`[PersonaRepo] Failed to create persona: User with ID ${userId} not found.`);
            throw new Error(`Cannot create persona: User with ID ${userId} not found.`);
        }
        else {
            console.error(`[PersonaRepo] Error creating persona for user ${userId}:`, error);
            throw new Error("Failed to create persona."); 
        }
    }
  }

  /**
   * Updates an existing persona for a specific user.
   * Ensures the persona name remains unique for the user if changed.
   * @param userId - The ID of the user who owns the persona.
   * @param personaId - The ID of the persona to update.
   * @param name - The new name for the persona.
   * @param color - The new color identifier for the persona.
   * @returns A promise that resolves to the updated Persona object.
   * @throws Error if fields missing, persona not found, user not authorized, or name is duplicate.
   */
  async updateForUser(userId: string, personaId: string, name: string, color: string): Promise<Persona> {
    const trimmedName = name?.trim();
    const trimmedColor = color?.trim();

    if (!userId || !personaId || !trimmedName || !trimmedColor) {
      throw new Error("User ID, Persona ID, a non-empty Persona name, and a color identifier are required for update.");
    }
    // Add color validation if needed

    try {
      // Use a transaction to first check ownership and then update
      const updatedPersona = await this.prisma.$transaction(async (tx) => {
        const persona = await tx.persona.findUnique({
          where: { id: personaId },
        });

        if (!persona) {
          throw new Error(`Persona with ID "${personaId}" not found.`);
        }

        if (persona.userId !== userId) {
          throw new Error(`User "${userId}" is not authorized to update persona "${personaId}".`);
        }

        // If name and color haven't changed, no need for update
        if (persona.name === trimmedName && persona.color === trimmedColor) {
             console.log(`[PersonaRepo] No changes detected for persona '${personaId}'. Skipping update.`);
             return persona; // Return existing data, no update needed
        }

        // Perform the update
        return await tx.persona.update({
          where: { id: personaId }, // Ownership already checked
          data: {
            name: trimmedName,
            color: trimmedColor, // Update the color identifier
          },
        });
      });

      console.log(`[PersonaRepo] Updated persona '${personaId}' for user ${userId} to name '${trimmedName}' and color '${trimmedColor}'`);
      return updatedPersona;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('userId') && error.meta?.target?.includes('name')) {
        console.warn(`[PersonaRepo] Update failed: Persona name '${trimmedName}' already exists for user ${userId}.`);
        throw new Error(`Update failed: Persona with name "${trimmedName}" already exists for this user.`);
      }
      // Handle specific errors thrown within the transaction
      if (error.message.includes('not found') || error.message.includes('not authorized')) {
         throw error;
      } 
      // Handle potential Prisma errors during update
      if (error.code === 'P2025') { // Record to update not found (should be caught earlier, but good practice)
        console.error(`[PersonaRepo] Update failed: Persona with ID ${personaId} not found (Prisma P2025).`);
        throw new Error(`Update failed: Persona with ID "${personaId}" not found.`);
      } 
      else {
        console.error(`[PersonaRepo] Error updating persona ${personaId} for user ${userId}:`, error);
        throw new Error("Failed to update persona.");
      }
    }
  }

  /**
   * Deletes a persona owned by a specific user.
   * @param userId - The ID of the user who owns the persona.
   * @param personaId - The ID of the persona to delete.
   * @returns A promise that resolves to the deleted Persona object.
   * @throws Error if persona not found or user not authorized.
   */
  async deleteForUser(userId: string, personaId: string): Promise<Persona> {
    if (!userId || !personaId) {
      throw new Error("User ID and Persona ID are required for deletion.");
    }

    try {
      // Use a transaction to first check ownership and then delete
      const deletedPersona = await this.prisma.$transaction(async (tx) => {
        const persona = await tx.persona.findUnique({
          where: { id: personaId },
        });

        if (!persona) {
          throw new Error(`Persona with ID "${personaId}" not found.`);
        }

        if (persona.userId !== userId) {
          throw new Error(`User "${userId}" is not authorized to delete persona "${personaId}".`);
        }

        // Perform the delete
        return await tx.persona.delete({
          where: { id: personaId }, // Ownership already checked
        });
      });

      console.log(`[PersonaRepo] Deleted persona '${personaId}' owned by user ${userId}`);
      return deletedPersona;
    } catch (error: any) {
        // Handle specific errors thrown within the transaction
        if (error.message.includes('not found') || error.message.includes('not authorized')) {
            throw error;
        }
        // Handle potential Prisma errors during delete
        if (error.code === 'P2025') { // Record to delete does not exist
            console.error(`[PersonaRepo] Delete failed: Persona with ID ${personaId} not found (Prisma P2025).`);
            throw new Error(`Delete failed: Persona with ID "${personaId}" not found.`);
        }
        else {
            console.error(`[PersonaRepo] Error deleting persona ${personaId} for user ${userId}:`, error);
            throw new Error("Failed to delete persona.");
        }
    }
  }
} 