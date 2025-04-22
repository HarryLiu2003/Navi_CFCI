# Prisma Connection Pooling with Supabase: Solving Authentication Issues

## Executive Summary

We resolved authentication failures in our application by properly configuring Prisma to work with Supabase's connection pooler. The issue affected user login and registration, producing PostgreSQL errors about missing prepared statements. By implementing dynamic parameter handling in our PrismaClient configuration, we were able to standardize on using the transaction pooler URL (port 6543) across all environments.

**Key Takeaways:**
- Connection poolers require specific Prisma configuration parameters
- Dynamic parameter detection allows consistent behavior across environments
- Understanding the technical details of pgBouncer and prepared statements is crucial

## 1. Problem Identification

### 1.1 Error Symptoms

In our production Vercel environment, users experienced authentication failures with this error:

```
Error [PrismaClientUnknownRequestError]: Invalid `prisma.user.findUnique()` invocation:
Error occurred during query execution: ConnectorError(ConnectorError { 
  user_facing_error: None, 
  kind: QueryError(PostgresError { 
    code: "26000", 
    message: "prepared statement \"s0\" does not exist", 
    severity: "ERROR", 
    detail: None, 
    column: None, 
    hint: None 
  }), 
  transient: false 
})
```

The issue specifically occurred when:
1. Using NextAuth's Prisma adapter with a transaction pooler URL (port 6543)
2. Attempting to sign in or register users

### 1.2 Environment Context

Our application architecture uses:
- **Frontend**: Next.js with NextAuth for authentication
- **Database**: PostgreSQL hosted on Supabase
- **ORM**: Prisma for database interactions
- **Connection Options**:
  - Transaction Pooler (port 6543)
  - Direct Connection (port 5432)

## 2. Root Cause Analysis

The issue stemmed from a fundamental mismatch between how NextAuth uses Prisma and how pgBouncer (Supabase's connection pooler) handles database connections.

### 2.1 Connection Types Explained

| Connection Type | URL Format | Characteristics |
|----------------|-----------|-----------------|
| **Transaction Pooler (6543)** | `postgresql://postgres.ref:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres` | - Optimized for many short-lived connections<br>- Does not persist prepared statements between transactions<br>- Requires special parameters for Prisma |
| **Direct Connection (5432)** | `postgresql://postgres:password@db.ref.supabase.co:5432/postgres` | - Standard PostgreSQL connection<br>- Maintains prepared statements<br>- Works natively with all Prisma features |

### 2.2 The Technical Conflict

1. **NextAuth's Prisma Adapter**: Uses prepared statements for database operations
2. **pgBouncer in Transaction Pooling Mode**: Does not maintain prepared statements between client connections
3. **Missing Parameters**: Our frontend PrismaClient was not configured with the required parameters for pooling

Our backend database service was already correctly configured to add the necessary parameters, but our frontend lacked this configuration.

## 3. Solution Implementation

We implemented a dynamic parameter handling approach that works across all environments.

### 3.1 Frontend PrismaClient Configuration

```javascript
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
```

This approach:
- Detects if we're using a pooler URL
- Dynamically adds the required parameters
- Remains flexible for different connection types
- Centralizes parameter handling in one place

### 3.2 Critical Parameters Explained

| Parameter | Purpose | Effect |
|-----------|---------|--------|
| `pgbouncer=true` | Informs Prisma about pooler usage | Modifies connection behavior |
| `prepared_statements=false` | Disables prepared statements | Prevents "statement doesn't exist" errors |
| `pool_timeout=30` | Sets connection acquisition timeout | Prevents indefinite hanging |

#### How `prepared_statements=false` Solves the Issue

When a client prepares a statement (like `s0`):
1. It's stored on the PostgreSQL server connection
2. With transaction pooling, different requests are routed to different connections
3. A prepared statement created on one connection isn't visible to another
4. Disabling prepared statements tells Prisma to use simple queries instead

### 3.3 Implementation Details

The parameters are added programmatically using this process:

1. **URL Detection**: Identify pooler URLs
   ```javascript
   if (dbUrl && dbUrl.includes('pooler.supabase.com:6543')) {
   ```

2. **URL Parsing & Parameter Addition**: Use standard URL API
   ```javascript
   const url = new URL(dbUrl);
   url.searchParams.set('pgbouncer', 'true');
   url.searchParams.set('prepared_statements', 'false');
   url.searchParams.set('pool_timeout', '30');
   ```

3. **Apply to PrismaClient**: Use modified URL
   ```javascript
   datasources: { db: { url: url.toString() } }
   ```

## 4. Configuration Strategy

We standardized on a single connection approach across environments:

### 4.1 Environment Configuration

| Environment | Connection URL | Parameters Added |
|-------------|---------------|-----------------|
| Vercel (Production) | Transaction Pooler (6543) | Programmatically |
| Local Development | Transaction Pooler (6543) | Programmatically |

### 4.2 Benefits of This Approach

1. **Simplicity**: One connection strategy across all environments
2. **Consistency**: Same behavior in development and production
3. **Efficiency**: Better handling of multiple concurrent connections
4. **Flexibility**: Code still supports direct connections if needed

## 5. Testing & Verification

When deploying or updating connection configurations, verify:

1. User registration works
2. User login works
3. Session persistence works
4. Database operations function correctly

## 6. Lessons & Best Practices

1. **Consistent Parameter Handling**: Use the same parameter handling logic across all services connecting to the database

2. **Understand Connection Behaviors**: Different connection types (pooler vs. direct) have different requirements and limitations

3. **Error Pattern Recognition**: The "prepared statement does not exist" error is a reliable indicator of a pooler configuration issue

4. **Parameter Management**: Add parameters programmatically rather than hardcoding in connection strings for better maintainability

5. **Monitoring After Changes**: After changing connection strategies, monitor:
   - Authentication success rates
   - Connection pool utilization
   - Query performance

## 7. References

- [Prisma documentation on connection pooling](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pooling)
- [Supabase connection pooling guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [NextAuth + Prisma documentation](https://authjs.dev/reference/adapter/prisma)
- [PgBouncer documentation](https://www.pgbouncer.org/usage.html) 