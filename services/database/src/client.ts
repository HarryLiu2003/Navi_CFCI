import { PrismaClient } from '@prisma/client'

// Connection pool configuration
// Using a singleton pattern for database connection pooling

// Keep a single instance of PrismaClient throughout the application
let prismaInstance: PrismaClient | undefined = undefined

/**
 * Get a shared Prisma client instance
 * This reuses the same connection pool across all requests
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    // Create a new instance only if one doesn't exist
    prismaInstance = new PrismaClient({
      log: ['error', 'warn'],
    })
    
    console.log('Database client initialized')
  }
  
  return prismaInstance
}

// Clean up database connections on app termination
process.on('beforeExit', async () => {
  if (prismaInstance) {
    console.log('Disconnecting database on app termination')
    await prismaInstance.$disconnect()
  }
}) 