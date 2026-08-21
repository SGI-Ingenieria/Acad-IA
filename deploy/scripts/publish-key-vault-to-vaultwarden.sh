#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_KEY_VAULT_NAME:?AZURE_KEY_VAULT_NAME is required}"
: "${BW_SERVER_URL:?BW_SERVER_URL is required}"
: "${BW_ITEM_ID:?BW_ITEM_ID is required}"
: "${BW_CLIENTID:?BW_CLIENTID is required}"
: "${BW_CLIENTSECRET:?BW_CLIENTSECRET is required}"
: "${BW_PASSWORD:?BW_PASSWORD is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=key-vault-secrets.sh
source "$script_dir/key-vault-secrets.sh"

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

vault_names_file="$work_dir/key-vault-secret-names"
az keyvault secret list \
  --vault-name "$AZURE_KEY_VAULT_NAME" \
  --query '[].name' \
  --output tsv \
  --only-show-errors > "$vault_names_file"
chmod 600 "$vault_names_file"

published=0
for pair in "${SECRET_MAP[@]}"; do
  vault_name="${pair%%:*}"
  field_name="${pair#*:}"
  if ! grep --fixed-strings --line-regexp --quiet "$vault_name" "$vault_names_file"; then
    continue
  fi

  value_file="$work_dir/$vault_name"
  next_item_file="$work_dir/item.next.json"
  az keyvault secret download \
    --vault-name "$AZURE_KEY_VAULT_NAME" \
    --name "$vault_name" \
    --file "$value_file" \
    --encoding utf-8 \
    --output none \
    --only-show-errors
  chmod 600 "$value_file"

  jq \
    --arg field_name "$field_name" \
    --rawfile field_value "$value_file" \
    '.fields = ((.fields // []) | map(select(.name != $field_name)) + [{name: $field_name, value: $field_value, type: 1}])' \
    "$item_file" > "$next_item_file"
  chmod 600 "$next_item_file"
  mv "$next_item_file" "$item_file"
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
bw edit item "$BW_ITEM_ID" "$(<"$encoded_file")" --session "$BW_SESSION" >/dev/null

echo "Published $published mapped backend secrets to the configured Vaultwarden item."
