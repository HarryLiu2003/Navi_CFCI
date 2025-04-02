FROM node:20-slim

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

# Install dependencies
RUN npm install

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

# Expose the port the app runs on
EXPOSE 5001

# For development, we start with ts-node for hot reloading
# For production, we use the compiled JS
CMD ["npm", "run", "dev"] 