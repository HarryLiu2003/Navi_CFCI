import { PrismaClient } from '@prisma/client';

// Declare a global variable to hold the Prisma client instance
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Initialize Prisma Client with connection pooler parameters
export const prisma =
  globalThis.prisma ||
  (() => {
    // Handle pgbouncer parameters for the pooler URL
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.includes('pooler.supabase.com:6543')) {
      const url = new URL(dbUrl);
      url.searchParams.set('pgbouncer', 'true');
      url.searchParams.set('prepared_statements', 'false');
      url.searchParams.set('pool_timeout', '30');
      
      return new PrismaClient({
        datasources: {
          db: {
            url: url.toString(),
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
    }
    
    // Direct connection doesn't need special handling
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  })();

// Set singleton in global scope for Next.js hot reloading
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
} 