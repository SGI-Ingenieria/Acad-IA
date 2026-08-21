#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=postgres}"
: "${POSTGRES_PASSWORD_ENCODED:?POSTGRES_PASSWORD_ENCODED is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${PGSSLMODE:=require}"

database_url="postgresql://postgres:${POSTGRES_PASSWORD_ENCODED}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=${PGSSLMODE}"

supabase migration up --db-url "${database_url}" --include-all --yes

PGPASSWORD="${POSTGRES_PASSWORD}" \
  psql \
    --host "${POSTGRES_HOST}" \
    --port "${POSTGRES_PORT}" \
    --username postgres \
    --dbname "${POSTGRES_DB}" \
    --set ON_ERROR_STOP=1 \
    --file supabase/seed.stage.sql
