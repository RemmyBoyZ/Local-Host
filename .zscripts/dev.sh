#!/bin/bash
cd /home/z/my-project

# Install dependencies
bun install 2>/dev/null

# Setup database - ONLY run db:push if database doesn't exist yet
if [ ! -f "db/custom.db" ]; then
  echo "[$(date)] Database not found. Creating new database..."
  bun run db:push 2>/dev/null
else
  echo "[$(date)] Database exists. Skipping db:push to preserve data."
fi

# Ensure .env has absolute path to database
if ! grep -q "file:/home/z/my-project/db/custom.db" .env 2>/dev/null; then
  echo "DATABASE_URL=file:/home/z/my-project/db/custom.db" > .env
fi

# Start dev server on port 3000
echo "[$(date)] Starting Next.js dev server on port 3000..."
PORT=3000 bun run dev
