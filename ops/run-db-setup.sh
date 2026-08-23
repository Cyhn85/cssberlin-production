#!/usr/bin/env sh
set -eu

has_migrations() {
  find prisma/migrations -mindepth 2 -maxdepth 2 -type f -name migration.sql -print -quit 2>/dev/null | grep -q .
}

# The production database was bootstrapped with `prisma db push`, so its tables
# exist but `_prisma_migrations` is empty. Running `migrate deploy` against that
# state fails ("database schema is not empty"): Prisma refuses to replay the
# init migration over tables it did not create. The fix is to baseline once —
# mark the init migration as already applied — after which every later
# migration deploys normally. `migrate resolve` is a no-op if the row is
# already there, so this stays safe on repeat runs.
baseline_if_needed() {
  if npx prisma migrate status 2>&1 | grep -q "database schema is not empty"; then
    echo "Baselining: marking 20240819000000_init as already applied"
    npx prisma migrate resolve --applied 20240819000000_init
  fi
}

if has_migrations; then
  baseline_if_needed
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
