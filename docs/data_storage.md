# Data Storage Best Practices

This document outlines the data storage setup for the Navi CFCI platform using Prisma ORM with Supabase PostgreSQL.

## Supabase Setup

### Creating a Supabase Project
1. Create an account at [Supabase](https://supabase.com) if you don't have one
2. Create a new project and give it a name (e.g., "navi-cfci")
3. Choose a strong password for the database
4. Select a region closest to your users
5. Wait for the new project to be initialized

### Getting Connection Credentials
1. In your Supabase project dashboard, navigate to **Settings** > **Database**
2. Find the **Connection string** section and select **URI** format
3. Copy the connection string, which will be in this format:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

### Connection Types
Supabase offers three connection types, each with different characteristics:

1. **Direct Connection** (Not IPv4 compatible)
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
   - For long-lived, persistent connections
   - Not suitable for IPv4 environments (like Docker)

2. **Transaction Pooler** (IPv4 compatible) - **RECOMMENDED FOR THIS PROJECT**
   ```
   postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
   - For stateless applications
   - Compatible with IPv4 networks
   - Handles connection pooling automatically

3. **Session Pooler** (IPv4 compatible)
   ```
   postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=0
   ```
   - Only recommended for IPv4 networks that cannot use transaction pooler

### Configuring the Database Service
1. Open the `.env` file in the `services/database` directory
2. Update the `DATABASE_URL` with your Supabase transaction pooler connection string:
   ```
   DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
3. Generate the Prisma client to apply the connection settings:
   ```bash
   cd services/database
   npx prisma generate
   ```

## Connection Pooling Best Practices

### Preventing "Prepared Statement Does Not Exist" Errors

When using Prisma with connection pooling (especially with Supabase or any PostgreSQL connection pooler like PgBouncer), you may encounter "prepared statement does not exist" errors. This happens because:

1. Prisma generates prepared statements with names like "s0", "s1", etc.
2. When connections are recycled in a pool, these prepared statements become invalid
3. Subsequent queries attempt to use statements that no longer exist on the server

#### Solution: Disable Prepared Statements

To prevent these errors, modify your connection URL to include these parameters:

```
postgresql://username:password@host:port/database?pgbouncer=true&prepared_statements=false
```

The two critical parameters are:
- `pgbouncer=true`: Tells Prisma this connection is using a connection pooler
- `prepared_statements=false`: Explicitly disables prepared statements

#### Implementation Example

Here's how to implement this in your Prisma client:

```typescript
// Create a Prisma client with proper connection pooling parameters
const getPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  const finalDbUrl = dbUrl.includes('?') 
    ? `${dbUrl}&pgbouncer=true&prepared_statements=false`
    : `${dbUrl}?pgbouncer=true&prepared_statements=false`;
  
  return new PrismaClient({
    datasources: {
      db: { url: finalDbUrl }
    },
  });
};
```

#### When to Use This Solution

This solution is particularly important for:
- Authentication flows with login/logout cycles
- Next.js applications with hot reloading during development
- Any service that interacts with the database intermittently
- Environments using connection poolers (including Supabase's pooler)

**IMPORTANT**: Always use this approach for all services that connect to the database through a connection pooler to avoid unpredictable errors.

## Authentication Implementation

The platform uses NextAuth.js integrated directly with the frontend Next.js application for user authentication.

### Authentication Schema

The following tables are added to the database schema for user authentication:

```prisma
model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  password      String
  sessions      Session[]
  interviews    Interview[]

  @@map("users")
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

### Password Security

Passwords are securely hashed using Node.js's built-in crypto module with PBKDF2:

```typescript
function hashPassword(password: string): string {
  // Use SHA-512 with 100,000 iterations and a random salt
  const algorithm = 'sha512';
  const iterations = 100000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    64,
    algorithm
  ).toString('hex');

  // Store in the format: algorithm:iterations:salt:hash
  return `${algorithm}:${iterations}:${salt}:${hash}`;
}
```

### Frontend Integration

Authentication is implemented with:
- A sign-in/registration page at `/auth/signin`
- Route protection via Next.js middleware
- Session persistence with NextAuth.js JWT tokens
- User interface elements that adapt to authentication state

### Required Environment Variables

For the authentication system to work, these environment variables must be set:

```
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-here

# Database URL for Prisma connection
DATABASE_URL=postgresql://username:password@host:port/database
```

### Schema Synchronization

When working with authentication tables:
1. Make schema changes in `services/database/prisma/schema.prisma` first
2. Run `npm run sync-schema` from the project root to keep schemas in sync
3. Run migrations and rebuild the frontend container

## Database Schema

### Main Tables

#### interviews
| Field              | Type                    | Description                               | Nullable |
|--------------------|-----------------------|-------------------------------------------|----------|
| id                 | uuid                  | Primary key                               | No       |
| created_at         | timestamp with timezone | Creation timestamp                        | No       |
| title              | text                  | Interview title                           | No       |
| problem_count      | integer               | Number of identified problem areas        | No       |
| transcript_length  | integer               | Length of the transcript in chunks        | No       |
| analysis_data      | jsonb                 | Full analysis results                     | No       |
| project_id         | text                  | Associated project ID                     | Yes      |
| interviewer        | text                  | Name of the interviewer                   | Yes      |
| interview_date     | timestamp with timezone | Date of the interview                    | Yes      |
| userId             | uuid                  | User who owns this interview              | Yes      |

#### users
| Field              | Type                    | Description                               | Nullable |
|--------------------|-----------------------|-------------------------------------------|----------|
| id                 | uuid                  | Primary key                               | No       |
| name               | text                  | User's display name                       | Yes      |
| email              | text                  | User's email (unique)                     | No       |
| password           | text                  | Hashed password                           | No       |

#### sessions
| Field              | Type                    | Description                               | Nullable |
|--------------------|-----------------------|-------------------------------------------|----------|
| id                 | uuid                  | Primary key                               | No       |
| sessionToken       | text                  | Unique session token                      | No       |
| userId             | uuid                  | Associated user                           | No       |
| expires            | timestamp             | Session expiration timestamp              | No       |

### Schema Creation
The schema is automatically created when you run migrations:

```bash
cd services/database
npx prisma migrate deploy
```

### Prisma Schema
The Prisma schema that defines this structure:

```prisma
model Interview {
  id               String    @id @default(uuid())
  created_at       DateTime  @default(now())
  title            String
  problem_count    Int
  transcript_length Int
  analysis_data    Json
  project_id       String?
  interviewer      String?
  interview_date   DateTime?
  user             User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  userId           String?

  @@map("interviews")
}
```

## Database Configuration

### Environment Variables
Required environment variables:

```
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
PORT=5001
NODE_ENV=development
```

### Database Client Setup

TypeScript:
```typescript
import { PrismaClient } from '@prisma/client'

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient()
  }
  return prismaInstance
}
```

Python:
```python
def __init__(self):
    self.api_url = os.environ.get("DATABASE_API_URL", "http://localhost:5001")
```

## Architecture

### Repository Pattern
```typescript
// repositories/interviewRepository.ts
export class InterviewRepository {
  private prisma = getPrismaClient()

  async findMany(params: {
    skip?: number,
    take?: number,
    where?: Prisma.InterviewWhereInput,
    orderBy?: Prisma.InterviewOrderByWithRelationInput
  }): Promise<Interview[]> {
    return this.prisma.interview.findMany({
      ...params,
      orderBy: params.orderBy || { created_at: 'desc' }
    })
  }
}
```

### Project Structure
```
src/
├── api/
│   └── server.ts         # API endpoints
├── repositories/
│   └── interviewRepository.ts  # Data access
└── client.ts             # Shared client
```

## Deployment

### Development
- Database service runs locally or in Docker
- Connects directly to Supabase PostgreSQL
- Environment variables point to Supabase
- Development data is in sync with production

### Production
- Frontend: Vercel
- Backend: Google Cloud Run
- Database: Supabase PostgreSQL

### Cross-Environment Setup

#### URLs
- Development:  `http://localhost:5001`
- Production: `https://database-service-xxxx-uc.a.run.app`

#### CORS
- Configured for both environments
- Update `src/api/server.ts` with production domains

#### Security
- Development: HTTPS to Supabase
- Production: HTTPS between services (Cloud Run)

## Schema Guidelines

### Required Fields
All models must include:
- `id`: UUID primary key
- `created_at`: Creation timestamp

### Best Practices
1. Use JSON columns for complex objects (like `analysis_data`)
2. Index foreign keys and frequently queried fields
3. Implement API-level access control
4. Secure credentials handling
5. Use snake_case for all field names to maintain consistency
6. Encrypt sensitive data

## Security

1. **Access Control**
   - Implement role-based access
   - Define record ownership

2. **Credentials**
   - Use service accounts
   - Never expose in client-side code
   - Regular key rotation

3. **Data Protection**
   - Encrypt sensitive data
   - Secure API endpoints
   - Regular backups

## Troubleshooting Common Supabase Issues

### Connection Issues
- If you see "Can't reach database server", ensure your connection string is correct
- For Docker environments, always use the Transaction Pooler connection (IPv4 compatible)
- Make sure the SSL settings are properly configured: `?sslmode=require`

### Authentication Issues
- Check if the password in your connection string is correct
- Ensure your IP address isn't blocked by Supabase

### Prisma Compatibility
- Use Prisma version 4.16.2 or later but not 6.x versions
- In Docker, use `node:20-slim` rather than Alpine for better compatibility
- Make sure SSL libraries are installed in your container: `openssl` and `libssl-dev`

### Field Naming Convention
- Always use snake_case for field names in the database
- Ensure all services are using consistent field naming (frontend, database, interview analysis)
- Update repository code when schema field names change 