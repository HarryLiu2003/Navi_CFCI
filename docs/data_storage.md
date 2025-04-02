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