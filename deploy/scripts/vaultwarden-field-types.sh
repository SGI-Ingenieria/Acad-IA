#!/usr/bin/env bash
set -euo pipefail

# Bitwarden/Vaultwarden custom field types: Text=0, Hidden=1, Boolean=2.
# Any field absent from this allowlist remains Hidden by default.
declare -Ar VAULTWARDEN_VISIBLE_FIELD_TYPES=(
  [ANON_KEY]=0
  [SUPABASE_PUBLISHABLE_KEY]=0
  [ANON_KEY_ASYMMETRIC]=0
  [POSTGRES_DB]=0
  [DASHBOARD_USERNAME]=0
  [S3_PROTOCOL_ACCESS_KEY_ID]=0
  [AI_RECOVERY_CRON_URL]=0
  [AI_RECOVERY_CRON_PUBLISHABLE_KEY]=0
  [OPENAI_PROJECT_ID]=0
  [AZURE_DOCUMENT_LAYOUT_ENABLED]=2
  [AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT]=0
  [SMTP_ADMIN_EMAIL]=0
  [SMTP_HOST]=0
  [SMTP_PORT]=0
  [SMTP_USER]=0
  [SMTP_SENDER_NAME]=0
  [SGU_NTLM_URL]=0
  [GITHUB_APP_ID]=0
  [GITHUB_APP_INSTALLATION_ID]=0
  [GITHUB_OWNER]=0
  [GITHUB_REPO]=0
  [GITHUB_REF]=0
  [GITHUB_MIGRATIONS_PATH]=0
  [RUSTFS_ACCESS_KEY_ID]=0
)

vaultwarden_field_type() {
  local field_name="$1"
  printf '%s' "${VAULTWARDEN_VISIBLE_FIELD_TYPES[$field_name]:-1}"
}

vaultwarden_upsert_field() {
  local item_file="$1"
  local output_file="$2"
  local field_name="$3"
  local value_file="$4"
  local field_type
  field_type="$(vaultwarden_field_type "$field_name")"

  if [[ "$field_type" == 2 ]]; then
    local boolean_value
    boolean_value="$(<"$value_file")"
    if [[ "$boolean_value" != 'true' && "$boolean_value" != 'false' ]]; then
      printf 'Vaultwarden boolean field %s must be true or false.\n' "$field_name" >&2
      return 65
    fi
  fi

  jq \
    --arg field_name "$field_name" \
    --rawfile field_value "$value_file" \
    --argjson field_type "$field_type" \
    '.fields = ((.fields // [])
      | map(select(.name != $field_name))
      + [{name: $field_name, value: $field_value, type: $field_type}])' \
    "$item_file" > "$output_file"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo 'This file is a library for the Vaultwarden publication workflow.' >&2
  exit 64
fi
