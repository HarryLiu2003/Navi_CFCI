# Navi CFCI Frontend

A Next.js application for the Navi CFCI platform that provides a user interface for transcript analysis.

## Development

### Local Development

#### Option 1: With Docker (via Docker Compose)
This is the recommended approach for full-stack development:

```bash
# From the root directory of the project
npm run start  # Starts all services including frontend
```

#### Option 2: Standalone
For frontend-only development:

```bash
# From the frontend directory
npm install
npm run dev
```

The application will be available at http://localhost:3000.

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:
- `NEXT_PUBLIC_API_URL`: URL of the API Gateway
  - Local development: `http://localhost:8000`
  - Production: Your Google Cloud Run API Gateway URL
- `NEXT_PUBLIC_ENV`: `development` or `production`

## Production Deployment

### Vercel Deployment (Recommended)

#### Prerequisites
- Vercel account
- GitHub repository connected to Vercel

#### Deployment Steps

1. Import the project in Vercel dashboard
2. Configure build settings:
   - Framework: Next.js
   - Root directory: `frontend`
3. Set up environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Google Cloud Run API Gateway URL
   - `NEXT_PUBLIC_ENV`: `production`
4. Deploy

#### Using Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Docker Deployment (Alternative)

The frontend includes a Dockerfile that can be used for deployment to container platforms.

```bash
# Build the Docker image
docker build -t navi-frontend --target production .

# Run the container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=your-api-url navi-frontend
```

## Configuration Files

- `vercel.json`: Configuration for Vercel deployment
- `next.config.ts`: Next.js configuration
- `Dockerfile`: For containerized deployment (primarily for local development)

## Notes

The frontend is designed for hybrid deployment:
- For local development: Use Docker Compose with the backend services
- For production: Deploy to Vercel while backend services are on Google Cloud Run
