# Multi-stage Docker build for database service

# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Install OpenSSL and other required libraries for Prisma
# These are needed for Prisma to connect to Supabase over SSL
# Using node:20-slim instead of Alpine for better compatibility with Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies including dev dependencies
RUN npm install --include=dev

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
# This step creates the TypeScript client based on the schema.prisma file
RUN npx prisma generate

# Copy source files
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript code
RUN npm run build

# Verify the build output
RUN ls -la dist/ && ls -la dist/api/ || echo "Build failed to create expected output directories"

# Development target with hot reload
FROM node:20-slim AS development
WORKDIR /app

# Install OpenSSL and other required libraries for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src/

EXPOSE 5001
CMD ["npm", "run", "dev"]

# Production stage
FROM node:20-slim AS production
WORKDIR /app

# Install OpenSSL and other required libraries for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 5001
CMD ["npm", "run", "start"] 