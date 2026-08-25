#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_KEY_VAULT_NAME:?AZURE_KEY_VAULT_NAME is required}"
: "${BW_SERVER_URL:?BW_SERVER_URL is required}"
: "${BW_ITEM_ID:?BW_ITEM_ID is required}"
: "${BW_CLIENTID:?BW_CLIENTID is required}"
: "${BW_CLIENTSECRET:?BW_CLIENTSECRET is required}"
: "${BW_PASSWORD:?BW_PASSWORD is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/key-vault-secrets.sh
source "$script_dir/key-vault-secrets.sh"
# shellcheck source=deploy/scripts/vaultwarden-field-types.sh
source "$script_dir/vaultwarden-field-types.sh"

work_dir="$(mktemp -d)"
chmod 700 "$work_dir"

cleanup() {
  bw lock >/dev/null 2>&1 || true
  bw logout >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

bw config server "$BW_SERVER_URL" >/dev/null
bw login --apikey >/dev/null
BW_SESSION="$(bw unlock --passwordenv BW_PASSWORD --raw)"
export BW_SESSION
bw sync --session "$BW_SESSION" >/dev/null

item_file="$work_dir/item.json"
bw get item "$BW_ITEM_ID" --session "$BW_SESSION" > "$item_file"
chmod 600 "$item_file"

download_mapped_secret_files "$work_dir" vault

published=0
declare -a published_field_types=()
for pair in "${SECRET_MAP[@]}"; do
  vault_name="${pair%%:*}"
  field_name="${pair#*:}"
  value_file="$work_dir/$vault_name"
  if [[ ! -s "$value_file" ]]; then
    continue
  fi

  next_item_file="$work_dir/item.next.json"
  vaultwarden_upsert_field "$item_file" "$next_item_file" "$field_name" "$value_file"
  chmod 600 "$next_item_file"
  mv "$next_item_file" "$item_file"
  published_field_types+=("$field_name:$(vaultwarden_field_type "$field_name")")
  published=$((published + 1))
done

if [[ "$published" -eq 0 ]]; then
  echo '::error::No mapped secrets were found in Azure Key Vault.'
  exit 1
fi

metadata_file="$work_dir/item.metadata.json"
jq \
  --arg synced_at "$(date --utc +%Y-%m-%dT%H:%M:%SZ)" \
  --arg source "Azure Key Vault: $AZURE_KEY_VAULT_NAME" \
  '.fields = ((.fields // [])
    | map(select(.name != "SYNCED_AT_UTC" and .name != "SYNC_SOURCE"))
    + [
        {name: "SYNCED_AT_UTC", value: $synced_at, type: 0},
        {name: "SYNC_SOURCE", value: $source, type: 0}
      ])' \
  "$item_file" > "$metadata_file"
chmod 600 "$metadata_file"
mv "$metadata_file" "$item_file"

encoded_file="$work_dir/item.encoded"
bw encode < "$item_file" > "$encoded_file"
chmod 600 "$encoded_file"
published_item_file="$work_dir/item.published.json"
bw edit item "$BW_ITEM_ID" "$(<"$encoded_file")" --session "$BW_SESSION" \
  >/dev/null
bw sync --session "$BW_SESSION" >/dev/null
bw get item "$BW_ITEM_ID" --session "$BW_SESSION" > "$published_item_file"
chmod 600 "$published_item_file"

for pair in "${published_field_types[@]}"; do
  field_name="${pair%%:*}"
  field_type="${pair#*:}"
  if ! jq --exit-status \
    --arg field_name "$field_name" \
    --argjson field_type "$field_type" \
    '[.fields[] | select(.name == $field_name and .type == $field_type)] | length == 1' \
    "$published_item_file" >/dev/null; then
    printf 'Vaultwarden did not persist the expected type for field %s.\n' "$field_name" >&2
    exit 1
  fi
done

echo "Published $published mapped backend fields to the configured Vaultwarden item."
