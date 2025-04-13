import { PrismaClient } from '@prisma/client';

// Declare a global variable to hold the Prisma client instance
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Initialize Prisma Client
// Use globalThis to ensure a single instance in development (due to Next.js hot reloading)
export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    // Optional: Add logging configuration if needed for debugging
    // log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// In development, assign the client instance to the global variable
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
} 