# Multi-stage Docker build for database service

# Use Node.js 20 Slim as the base image
FROM node:20-slim AS base

# Set working directory
WORKDIR /app

# Install necessary OS packages (including openssl for Prisma)
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) needed for the build
RUN npm install

# Copy the rest of the source code BEFORE build
COPY . .

# Generate Prisma client (important after npm install & schema copy)
RUN npx prisma generate

# Build TypeScript code
RUN npm run build

# Remove development dependencies AFTER build
RUN npm prune --omit=dev

# Development target with hot reload
FROM base AS development
# Note: This stage will inherit the pruned node_modules from the base stage initially.
# We need to re-install dev dependencies here for local dev.

WORKDIR /app

# Copy package files again for this stage
COPY package*.json ./

# Install ALL dependencies, including devDependencies for local dev
RUN npm install

# Copy application code (overwrites what was copied in base, might be overwritten by volume mount)
COPY . .

# Copy the entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Generate Prisma client again for dev environment (just in case)
RUN npx prisma generate

# Set the entrypoint script for the dev stage too
ENTRYPOINT ["/app/entrypoint.sh"]

# CMD is now effectively ignored as ENTRYPOINT takes precedence,
# but can be useful documentation / potential override target.
# Assuming dev server runs on 5001 locally
EXPOSE 5001
CMD ["npm", "run", "dev"]

# --- Production Stage ---
FROM base AS production
# This stage inherits the already built code and pruned node_modules from the final state of the 'base' stage.

WORKDIR /app

# Copy necessary artifacts from the 'base' stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY package*.json ./
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose the production port (Cloud Run expects 8080 by default)
EXPOSE 8080

# Set the entrypoint script to run migrations then start
ENTRYPOINT ["/app/entrypoint.sh"]

# CMD is not needed as ENTRYPOINT handles the final command