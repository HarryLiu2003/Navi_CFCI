import { PrismaClient } from '@prisma/client'

// Simple singleton pattern for PrismaClient

// Keep a single instance of PrismaClient throughout the application
let prismaInstance: PrismaClient | null = null

interface QueryParams {
  query: string;
  args: any[];
}

/**
 * Get a shared Prisma client instance.
 * Ensures only one instance is created and reused.
 * Configures the client with PgBouncer support and proper logging.
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    try {
      // Ensure DATABASE_URL has the required parameters for PgBouncer
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is not set')
      }

      // Add PgBouncer parameters if they're not already present
      const finalDbUrl = dbUrl.includes('?') 
        ? `${dbUrl}&pgbouncer=true&prepared_statements=false`
        : `${dbUrl}?pgbouncer=true&prepared_statements=false`

      // Create a new instance only if one doesn't exist
      prismaInstance = new PrismaClient({
        // Recommended logging for production
        log: [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' }
        ],
        datasources: {
          db: {
            url: finalDbUrl
          }
        }
      })
      console.log('PrismaClient initialized successfully')
    } catch (error) {
      console.error('Failed to initialize PrismaClient:', error)
      throw error
    }
  }
  return prismaInstance
}

/**
 * Cleanup function for graceful shutdown.
 * Disconnects the Prisma client and resets the instance.
 */
export async function cleanup() {
  if (prismaInstance) {
    try {
      console.log('Disconnecting PrismaClient...')
      await prismaInstance.$disconnect()
      console.log('PrismaClient disconnected successfully')
    } catch (error) {
      console.error('Error disconnecting PrismaClient:', error)
    } finally {
      prismaInstance = null
    }
  }
}

// Handle graceful shutdown
process.on('beforeExit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup) 