#!/usr/bin/env sh
set -eu

has_migrations() {
  find prisma/migrations -mindepth 2 -maxdepth 2 -type f -name migration.sql -print -quit 2>/dev/null | grep -q .
}

if has_migrations; then
  echo "Applying versioned Prisma migrations"
  npx prisma migrate deploy
else
  echo "No committed Prisma migration history found; using prisma db push as a temporary bootstrap step"
  npx prisma db push --skip-generate
fi

if [ "${RUN_DB_SEED:-1}" = "1" ]; then
  echo "Running seed script"
  node prisma/seed.js
else
  echo "Skipping seed script because RUN_DB_SEED=${RUN_DB_SEED:-0}"
fi