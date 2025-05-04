#!/bin/sh
# Exit immediately if a command exits with a non-zero status.
set -e

# Store the runtime DATABASE_URL provided by Cloud Run/Secrets
RUNTIME_DATABASE_URL=$DATABASE_URL
echo "Runtime DATABASE_URL stored (should be pooler URL from secret)"

# Ensure MIGRATE_DATABASE_URL is set (required for migrations)
# if [ -z "$MIGRATE_DATABASE_URL" ]; then
#   echo "Error: MIGRATE_DATABASE_URL is not set. Cannot run migrations."
#   exit 1
# fi
# echo "MIGRATE_DATABASE_URL is set (should be direct URL from secret)"

# Run database migrations using the direct URL
# echo "Running database migrations (deploy) using MIGRATE_DATABASE_URL..."
# Export the direct URL TEMPORARILY for the prisma command
# export DATABASE_URL=$MIGRATE_DATABASE_URL
# npx prisma migrate deploy
# Unset the temporary export (or just overwrite below)
# unset DATABASE_URL
# echo "Database migrations finished."

# Explicitly export the RUNTIME Database URL before starting the app
export DATABASE_URL=$RUNTIME_DATABASE_URL
echo "Exported RUNTIME_DATABASE_URL as DATABASE_URL for application start."

# Execute the appropriate server command based on NODE_ENV
# Defaults to production if NODE_ENV is not set or not 'development'
if [ "$NODE_ENV" = "development" ]; then
  echo "Starting development server (npm run dev)..."
  exec npm run dev
else
  echo "Starting production server (npm run start)..."
  exec npm run start
fi 