#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AZURE_KEY_VAULT_NAME='test-vault'
# shellcheck source=deploy/scripts/key-vault-secrets.sh
source "$script_dir/key-vault-secrets.sh"
# shellcheck source=deploy/scripts/vaultwarden-field-types.sh
source "$script_dir/vaultwarden-field-types.sh"

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT
printf '{"fields":[{"name":"ANON_KEY","value":"old","type":1}]}' > "$work_dir/item.json"
printf 'public-anon-value' > "$work_dir/text"
printf 'false' > "$work_dir/boolean"
printf 'private-value' > "$work_dir/hidden"

vaultwarden_upsert_field "$work_dir/item.json" "$work_dir/text.json" ANON_KEY "$work_dir/text"
vaultwarden_upsert_field \
  "$work_dir/text.json" "$work_dir/boolean.json" AZURE_DOCUMENT_LAYOUT_ENABLED "$work_dir/boolean"
vaultwarden_upsert_field \
  "$work_dir/boolean.json" "$work_dir/hidden.json" SERVICE_ROLE_KEY "$work_dir/hidden"

jq --exit-status '
  (.fields | map(select(.name == "ANON_KEY"))) ==
    [{"name":"ANON_KEY","value":"public-anon-value","type":0}] and
  (.fields | map(select(.name == "AZURE_DOCUMENT_LAYOUT_ENABLED"))) ==
    [{"name":"AZURE_DOCUMENT_LAYOUT_ENABLED","value":"false","type":2}] and
  (.fields | map(select(.name == "SERVICE_ROLE_KEY"))) ==
    [{"name":"SERVICE_ROLE_KEY","value":"private-value","type":1}]
' "$work_dir/hidden.json" >/dev/null

test "$(vaultwarden_field_type SUPABASE_PUBLISHABLE_KEY)" = 0
test "$(vaultwarden_field_type DASHBOARD_USERNAME)" = 0
test "$(vaultwarden_field_type GITHUB_APP_ID)" = 0
test "$(vaultwarden_field_type JWT_SECRET)" = 1
test "$(vaultwarden_field_type JWT_JWKS)" = 1
test "$(vaultwarden_field_type SUPABASE_SECRET_KEY)" = 1
test "$(vaultwarden_field_type GITHUB_APP_PRIVATE_KEY)" = 1
test "$(vaultwarden_field_type AZURE_DOCUMENT_LAYOUT_ENABLED)" = 2

declare -A mapped_fields=()
for pair in "${SECRET_MAP[@]}"; do
  mapped_fields["${pair#*:}"]=1
done
for field_name in "${!VAULTWARDEN_VISIBLE_FIELD_TYPES[@]}"; do
  if [[ -z "${mapped_fields[$field_name]+present}" ]]; then
    printf 'Visible Vaultwarden field is not present in SECRET_MAP: %s\n' "$field_name" >&2
    exit 1
  fi
done

printf 'not-a-boolean' > "$work_dir/invalid-boolean"
if vaultwarden_upsert_field \
  "$work_dir/item.json" "$work_dir/invalid.json" AZURE_DOCUMENT_LAYOUT_ENABLED \
  "$work_dir/invalid-boolean" 2>/dev/null; then
  echo 'Invalid boolean values must be rejected.' >&2
  exit 1
fi

echo 'Vaultwarden field classification tests passed.'
