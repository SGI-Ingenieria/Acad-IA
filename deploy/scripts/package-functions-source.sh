#!/usr/bin/env bash
set -euo pipefail

readonly REVISION="${1:-HEAD}"
readonly OUTPUT="${2:?Usage: package-functions-source.sh [revision] output.tar.gz}"
readonly MAX_BYTES="${FUNCTIONS_BUNDLE_MAX_BYTES:-900000}"
REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
readonly REPOSITORY_ROOT

temporary_tar="$(mktemp)"
temporary_listing="$(mktemp)"
trap 'rm -f "$temporary_tar" "$temporary_listing"' EXIT

git -C "$REPOSITORY_ROOT" archive \
  --format=tar \
  --output="$temporary_tar" \
  "$REVISION" \
  -- supabase/functions \
  ':(exclude)supabase/functions/Dockerfile' \
  ':(exclude)supabase/functions/.dockerignore' \
  ':(exclude)supabase/functions/tests'
gzip -n -9 < "$temporary_tar" > "$OUTPUT"

size="$(stat -c '%s' "$OUTPUT")"
if (( size > MAX_BYTES )); then
  printf 'Functions bundle is %s bytes; the limit is %s bytes.\n' "$size" "$MAX_BYTES" >&2
  exit 1
fi

tar -tzf "$OUTPUT" > "$temporary_listing"
grep -Fqx 'supabase/functions/main/index.ts' "$temporary_listing"
sha256="$(sha256sum "$OUTPUT" | cut -d ' ' -f 1)"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'archive=%s\n' "$OUTPUT"
    printf 'bytes=%s\n' "$size"
    printf 'sha256=%s\n' "$sha256"
  } >> "$GITHUB_OUTPUT"
else
  printf 'archive=%s\nbytes=%s\nsha256=%s\n' "$OUTPUT" "$size" "$sha256"
fi
