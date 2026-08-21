#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=postgres}"
: "${POSTGRES_PASSWORD_ENCODED:?POSTGRES_PASSWORD_ENCODED is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${PGSSLMODE:=require}"
: "${DATABASE_WAIT_SECONDS:=600}"

case "$DATABASE_WAIT_SECONDS" in
  ''|*[!0-9]*)
    echo "DATABASE_WAIT_SECONDS must be a non-negative integer" >&2
    exit 1
    ;;
esac

waited=0
until pg_isready \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username postgres \
  --dbname "$POSTGRES_DB" >/dev/null 2>&1; do
  if [ "$waited" -ge "$DATABASE_WAIT_SECONDS" ]; then
    echo "Postgres was not ready after ${DATABASE_WAIT_SECONDS}s" >&2
    exit 1
  fi
  if [ $((waited % 30)) -eq 0 ]; then
    echo "Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
  fi
  sleep 2
  waited=$((waited + 2))
done

database_url="postgresql://postgres:${POSTGRES_PASSWORD_ENCODED}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=${PGSSLMODE}"

supabase migration up --db-url "${database_url}" --include-all --yes

seed_marker="$(
  PGPASSWORD="${POSTGRES_PASSWORD}" \
    psql \
      --host "${POSTGRES_HOST}" \
      --port "${POSTGRES_PORT}" \
      --username postgres \
      --dbname "${POSTGRES_DB}" \
      --tuples-only \
      --no-align \
      --set ON_ERROR_STOP=1 \
      --command "SELECT EXISTS (SELECT 1 FROM public.estructuras_plan WHERE id = '69fb2b77-5a95-47e0-bf1f-389d384200e4');"
)"

if [ "${seed_marker}" = "t" ]; then
  echo "Stage seed already applied; skipping."
  exit 0
fi

PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    --host "${POSTGRES_HOST}" \
    --port "${POSTGRES_PORT}" \
    --username postgres \
    --dbname "${POSTGRES_DB}" \
    --set ON_ERROR_STOP=1 \
    --file supabase/seed.stage.sql
