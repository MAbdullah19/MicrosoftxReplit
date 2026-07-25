#!/bin/bash
set -e

# Install any new dependencies (fast no-op when unchanged)
npm install --no-audit --no-fund

# Apply idempotent SQL (schemas + functions), then push Drizzle schema
if [ -n "$DATABASE_URL" ]; then
  npm run db:apply-sql
  npx drizzle-kit push --force
fi
