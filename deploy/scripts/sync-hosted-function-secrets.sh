#!/usr/bin/env bash
set -euo pipefail

project_ref="${1:?Usage: sync-hosted-function-secrets.sh PROJECT_REF [FRONTEND_URL]}"
frontend_url="${2:-}"

# Keep this list limited to configuration consumed by hosted Edge Functions.
# Supabase injects its own SUPABASE_* values; AKS-only identity, database and
# Studio credentials must never cross this boundary.
function_secret_names=(
  AI_RECOVERY_CRON_PUBLISHABLE_KEY
  AI_RECOVERY_CRON_SECRET
  CARBONE_API_TOKEN
  GOOGLE_API_KEY
  INTERNAL_AUTH_PEPPER
  INTERNAL_AUTH_SECRET
  OPENAI_API_KEY
  OPENAI_PROJECT_ID
  OPENAI_WEBHOOK_SECRET
  SGU_NTLM_URL
  USER_CREATION_MASTER_PASSWORD
)

secret_args=()
missing=()
for name in "${function_secret_names[@]}"; do
  value="${!name:-}"
  if [[ -z "$value" ]]; then
    missing+=("$name")
  else
    secret_args+=("$name=$value")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf '::error::Missing hosted Edge Function configuration: %s\n' \
    "${missing[*]}" >&2
  exit 1
fi

if [[ -n "$frontend_url" ]]; then
  secret_args+=("FRONTEND_URL=${frontend_url%/}")
fi

supabase secrets set "${secret_args[@]}" --project-ref "$project_ref"

expected_names=("${function_secret_names[@]}")
[[ -z "$frontend_url" ]] || expected_names+=(FRONTEND_URL)
remote_secrets_json="$(
  supabase secrets list --project-ref "$project_ref" --output json
)"
EXPECTED_SECRET_NAMES="$(printf '%s\n' "${expected_names[@]}")" \
REMOTE_SECRETS_JSON="$remote_secrets_json" node <<'NODE'
const expected = process.env.EXPECTED_SECRET_NAMES.trim().split('\n')
const actual = new Set(JSON.parse(process.env.REMOTE_SECRETS_JSON).map(({ name }) => name))
const missing = expected.filter((name) => !actual.has(name))
if (missing.length > 0) {
  console.error(`::error::Supabase did not report: ${missing.join(', ')}`)
  process.exit(1)
}
NODE

echo "Hosted Edge Function configuration synchronized for $project_ref."
