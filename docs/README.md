# Navi CFCI Documentation

Welcome to the Navi CFCI documentation hub. This index provides an overview of all available documentation and guides you to the right resource for your needs.

## Documentation Overview

| # | Document | Purpose | When to Use |
|---|----------|---------|-------------|
| 1 | [Project Guide](1_project_guide.md) | Introduction to architecture and components | Start here for a high-level project overview |
| 2 | [Architecture](2_architecture.md) | Detailed system architecture diagrams and descriptions | When you need to understand the system design |
| 3 | [Data Storage](3_data_storage.md) | Database schema, Prisma setup, and authentication | When working with data models or auth |
| 4 | [Testing](4_testing.md) | Testing strategies and guidelines | When writing or running tests |
| 5 | [Deployment](5_deployment.md) | Production deployment instructions | When preparing for or troubleshooting deployment |

## Getting Started

If you're new to the project, follow this recommended reading order:

1. **[Project Guide](1_project_guide.md)** - Start with a high-level overview of the entire system
2. **[Architecture](2_architecture.md)** - Dive deeper into the technical architecture
3. **[Data Storage](3_data_storage.md)** - Understand the data models and auth system
4. **[Testing](4_testing.md)** - Learn how to test the application
5. **[Deployment](5_deployment.md)** - Learn how to deploy to production

## Document Purposes

### 1. Project Guide
Serves as your entry point to the Navi CFCI project. It covers:
- Project overview and features
- Component architecture and dependencies
- Environment variables
- Development workflow

### 2. Architecture
Provides detailed technical architecture information:
- System diagrams for both development and production
- Component descriptions and responsibilities
- Communication flow between services
- Technology stack details

### 3. Data Storage
Comprehensive guide for database implementation:
- Supabase PostgreSQL setup
- Authentication implementation with NextAuth.js
- Prisma schema and models
- Connection pooling and best practices
- Security considerations

### 4. Testing
Explains the testing approach for all parts of the application:
- Frontend unit tests with Jest
- Frontend end-to-end tests with Cypress
- Backend service tests with PyTest
- Test data management
- Continuous integration testing

### 5. Deployment
Step-by-step instructions for production deployment:
- Google Cloud Run setup for backend services
- Vercel deployment for frontend
- Environment configuration
- CI/CD with GitHub Actions
- Troubleshooting common deployment issues

## Cross-Service Documentation

For service-specific information, refer to the README.md files in each service directory:
- `/services/database/README.md`
- `/services/api_gateway/README.md`
- `/services/interview_analysis/README.md`
- `/services/sprint1_deprecated/README.md`
- `/frontend/README.md`

## Keeping Documentation Updated

When making changes to the codebase, please update the relevant documentation. For significant architecture changes, update both the service-specific README and the central documentation in this directory. 