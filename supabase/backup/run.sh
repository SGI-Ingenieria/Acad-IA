#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=postgres}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${RUSTFS_ENDPOINT:?RUSTFS_ENDPOINT is required}"
: "${RUSTFS_ACCESS_KEY_ID:?RUSTFS_ACCESS_KEY_ID is required}"
: "${RUSTFS_SECRET_ACCESS_KEY:?RUSTFS_SECRET_ACCESS_KEY is required}"
: "${RUSTFS_BUCKET:=respaldos}"
: "${RUSTFS_PREFIX:=acad-ia/supabase}"
: "${RUSTFS_REGION:=us-east-1}"

backup_dir="$(mktemp -d)"
trap 'rm -rf "$backup_dir"' EXIT HUP INT TERM

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
week="$(date -u +%G-W%V)"
destination="rustfs:${RUSTFS_BUCKET}/${RUSTFS_PREFIX}/${week}/${timestamp}"

export PGPASSWORD="$POSTGRES_PASSWORD"
export RCLONE_CONFIG_RUSTFS_TYPE=s3
export RCLONE_CONFIG_RUSTFS_PROVIDER=Other
export RCLONE_CONFIG_RUSTFS_ACCESS_KEY_ID="$RUSTFS_ACCESS_KEY_ID"
export RCLONE_CONFIG_RUSTFS_SECRET_ACCESS_KEY="$RUSTFS_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_RUSTFS_ENDPOINT="$RUSTFS_ENDPOINT"
export RCLONE_CONFIG_RUSTFS_REGION="$RUSTFS_REGION"
export RCLONE_CONFIG_RUSTFS_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_RUSTFS_ACL=private

pg_dumpall \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --roles-only \
  --no-role-passwords \
  > "$backup_dir/roles.sql"

pg_dump \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --schema-only \
  --no-owner \
  > "$backup_dir/schema.sql"

pg_dump \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --data-only \
  --disable-triggers \
  --no-owner \
  > "$backup_dir/data.sql"

tar --exclude='./lost+found' -C /var/lib/storage -czf "$backup_dir/storage.tar.gz" .

(
  cd "$backup_dir"
  sha256sum roles.sql schema.sql data.sql storage.tar.gz > SHA256SUMS
)

cat > "$backup_dir/manifest.txt" <<EOF
created_at=${timestamp}
postgres_database=${POSTGRES_DB}
storage_backend=file
format=roles-schema-data-and-storage
EOF

rclone copy "$backup_dir" "$destination" \
  --checkers 4 \
  --transfers 2 \
  --s3-no-check-bucket \
  --log-level NOTICE

echo "Backup completed at ${RUSTFS_BUCKET}/${RUSTFS_PREFIX}/${week}/${timestamp}"
