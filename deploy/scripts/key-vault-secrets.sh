#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_KEY_VAULT_NAME:?AZURE_KEY_VAULT_NAME is required}"

readonly SECRET_MAP=(
  'jwt-secret:JWT_SECRET'
  'anon-key:ANON_KEY'
  'service-role-key:SERVICE_ROLE_KEY'
  'supabase-publishable-key:SUPABASE_PUBLISHABLE_KEY'
  'supabase-secret-key:SUPABASE_SECRET_KEY'
  'anon-key-asymmetric:ANON_KEY_ASYMMETRIC'
  'service-role-key-asymmetric:SERVICE_ROLE_KEY_ASYMMETRIC'
  'jwt-keys:JWT_KEYS'
  'jwt-jwks:JWT_JWKS'
  'postgres-password:POSTGRES_PASSWORD'
  'postgres-password-encoded:POSTGRES_PASSWORD_ENCODED'
  'postgres-db:POSTGRES_DB'
  'dashboard-username:DASHBOARD_USERNAME'
  'dashboard-password:DASHBOARD_PASSWORD'
  'secret-key-base:SECRET_KEY_BASE'
  'realtime-db-enc-key:REALTIME_DB_ENC_KEY'
  'vault-enc-key:VAULT_ENC_KEY'
  'pg-meta-crypto-key:PG_META_CRYPTO_KEY'
  's3-protocol-access-key-id:S3_PROTOCOL_ACCESS_KEY_ID'
  's3-protocol-access-key-secret:S3_PROTOCOL_ACCESS_KEY_SECRET'
  'internal-auth-secret:INTERNAL_AUTH_SECRET'
  'internal-auth-pepper:INTERNAL_AUTH_PEPPER'
  'user-creation-master-password:USER_CREATION_MASTER_PASSWORD'
  'openai-api-key:OPENAI_API_KEY'
  'openai-project-id:OPENAI_PROJECT_ID'
  'openai-webhook-secret:OPENAI_WEBHOOK_SECRET'
  'carbone-api-token:CARBONE_API_TOKEN'
  'google-api-key:GOOGLE_API_KEY'
  'smtp-admin-email:SMTP_ADMIN_EMAIL'
  'smtp-host:SMTP_HOST'
  'smtp-port:SMTP_PORT'
  'smtp-user:SMTP_USER'
  'smtp-pass:SMTP_PASS'
  'smtp-sender-name:SMTP_SENDER_NAME'
  'sgu-ntlm-url:SGU_NTLM_URL'
  'github-app-id:GITHUB_APP_ID'
  'github-app-installation-id:GITHUB_APP_INSTALLATION_ID'
  'github-app-private-key:GITHUB_APP_PRIVATE_KEY'
  'github-owner:GITHUB_OWNER'
  'github-repo:GITHUB_REPO'
  'github-ref:GITHUB_REF'
  'github-migrations-path:GITHUB_MIGRATIONS_PATH'
  'rustfs-access-key-id:RUSTFS_ACCESS_KEY_ID'
  'rustfs-secret-access-key:RUSTFS_SECRET_ACCESS_KEY'
)

secret_exists() {
  az keyvault secret show \
    --vault-name "$AZURE_KEY_VAULT_NAME" \
    --name "$1" \
    --query id \
    --output tsv \
    --only-show-errors >/dev/null 2>&1
}

set_secret_file() {
  local name="$1"
  local file="$2"
  az keyvault secret set \
    --vault-name "$AZURE_KEY_VAULT_NAME" \
    --name "$name" \
    --file "$file" \
    --encoding utf-8 \
    --output none \
    --only-show-errors
}

set_secret_value() {
  local name="$1"
  local value="$2"
  local work_dir="$3"
  local file="$work_dir/$name"
  printf '%s' "$value" > "$file"
  chmod 600 "$file"
  set_secret_file "$name" "$file"
}

key_vault_name_for_env() {
  local env_name="$1"
  local pair
  for pair in "${SECRET_MAP[@]}"; do
    if [[ "${pair#*:}" == "$env_name" ]]; then
      printf '%s' "${pair%%:*}"
      return 0
    fi
  done
  return 1
}

store_json_secrets() {
  local json_file="$1"
  local work_dir="$2"
  local env_name
  while IFS= read -r env_name; do
    local vault_name
    vault_name="$(key_vault_name_for_env "$env_name")"
    jq --raw-output --join-output --arg key "$env_name" '.[$key]' "$json_file" \
      > "$work_dir/$vault_name"
    chmod 600 "$work_dir/$vault_name"
    set_secret_file "$vault_name" "$work_dir/$vault_name"
  done < <(jq --raw-output 'keys[]' "$json_file")
}

download_kubernetes_secret() {
  : "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"
  local work_dir="$1"
  local secret_dir="$work_dir/kubernetes"
  mkdir -p "$secret_dir"
  chmod 700 "$secret_dir"

  local pair vault_name env_name file
  for pair in "${SECRET_MAP[@]}"; do
    vault_name="${pair%%:*}"
    env_name="${pair#*:}"
    if secret_exists "$vault_name"; then
      file="$secret_dir/$env_name"
      az keyvault secret download \
        --vault-name "$AZURE_KEY_VAULT_NAME" \
        --name "$vault_name" \
        --file "$file" \
        --encoding utf-8 \
        --output none \
        --only-show-errors
      chmod 600 "$file"
    fi
  done

  local required=(
    JWT_SECRET ANON_KEY SERVICE_ROLE_KEY SUPABASE_PUBLISHABLE_KEY
    SUPABASE_SECRET_KEY ANON_KEY_ASYMMETRIC SERVICE_ROLE_KEY_ASYMMETRIC
    JWT_KEYS JWT_JWKS POSTGRES_PASSWORD POSTGRES_PASSWORD_ENCODED POSTGRES_DB
    DASHBOARD_USERNAME DASHBOARD_PASSWORD SECRET_KEY_BASE REALTIME_DB_ENC_KEY
    VAULT_ENC_KEY PG_META_CRYPTO_KEY S3_PROTOCOL_ACCESS_KEY_ID
    S3_PROTOCOL_ACCESS_KEY_SECRET OPENAI_API_KEY OPENAI_PROJECT_ID
    OPENAI_WEBHOOK_SECRET CARBONE_API_TOKEN GOOGLE_API_KEY SMTP_ADMIN_EMAIL
    SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_SENDER_NAME
    RUSTFS_ACCESS_KEY_ID RUSTFS_SECRET_ACCESS_KEY
  )
  local key
  for key in "${required[@]}"; do
    if [[ ! -s "$secret_dir/$key" ]]; then
      echo "::error::Azure Key Vault is missing required secret mapping: $key"
      return 1
    fi
  done

  local kubectl_args=(
    create secret generic acad-ia-backend-secrets
    --namespace "$AKS_NAMESPACE"
    --dry-run=client
    --output yaml
  )
  for file in "$secret_dir"/*; do
    kubectl_args+=("--from-file=$(basename "$file")=$file")
  done
  kubectl "${kubectl_args[@]}" | kubectl apply -f -
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo 'This file is a library for the deployment workflows.' >&2
  exit 64
fi
