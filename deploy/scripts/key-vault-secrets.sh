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
  'vault-root-key:VAULT_ROOT_KEY'
  'pg-meta-crypto-key:PG_META_CRYPTO_KEY'
  's3-protocol-access-key-id:S3_PROTOCOL_ACCESS_KEY_ID'
  's3-protocol-access-key-secret:S3_PROTOCOL_ACCESS_KEY_SECRET'
  'internal-auth-secret:INTERNAL_AUTH_SECRET'
  'internal-auth-pepper:INTERNAL_AUTH_PEPPER'
  'user-creation-master-password:USER_CREATION_MASTER_PASSWORD'
  'ai-recovery-cron-url:AI_RECOVERY_CRON_URL'
  'ai-recovery-cron-publishable-key:AI_RECOVERY_CRON_PUBLISHABLE_KEY'
  'ai-recovery-cron-secret:AI_RECOVERY_CRON_SECRET'
  'openai-api-key:OPENAI_API_KEY'
  'openai-project-id:OPENAI_PROJECT_ID'
  'openai-webhook-secret:OPENAI_WEBHOOK_SECRET'
  'azure-document-layout-enabled:AZURE_DOCUMENT_LAYOUT_ENABLED'
  'azure-document-intelligence-endpoint:AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT'
  'azure-document-intelligence-key:AZURE_DOCUMENT_INTELLIGENCE_KEY'
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

declare -A KEY_VAULT_SECRET_NAMES=()
KEY_VAULT_SECRET_CACHE_LOADED=false

load_key_vault_secret_names() {
  if [[ "$KEY_VAULT_SECRET_CACHE_LOADED" == 'true' ]]; then
    return 0
  fi

  local names name
  names="$(
    az keyvault secret list \
      --vault-name "$AZURE_KEY_VAULT_NAME" \
      --query '[].name' \
      --output tsv \
      --only-show-errors
  )"
  while IFS= read -r name; do
    [[ -n "$name" ]] && KEY_VAULT_SECRET_NAMES["$name"]=1
  done <<< "$names"
  KEY_VAULT_SECRET_CACHE_LOADED=true
}

secret_exists() {
  load_key_vault_secret_names
  [[ -n "${KEY_VAULT_SECRET_NAMES[$1]+present}" ]]
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
  KEY_VAULT_SECRET_NAMES["$name"]=1
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

ensure_vault_root_key() {
  : "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"
  local work_dir="$1"
  local vault_name='vault-root-key'
  local file="$work_dir/$vault_name"
  local key=''

  mkdir -p "$work_dir"
  chmod 700 "$work_dir"

  if secret_exists "$vault_name"; then
    return 0
  fi

  if key="$(
    kubectl exec statefulset/supabase-db \
      --namespace "$AKS_NAMESPACE" \
      --container supabase-db \
      -- cat /etc/postgresql-custom/pgsodium_root.key \
      2>/dev/null
  )"; then
    echo 'Migrating the existing Vault root key to Azure Key Vault.'
  else
    echo 'No existing database root key was found; generating a new Vault root key.'
    key="$(openssl rand -hex 32)"
  fi

  key="${key//$'\r'/}"
  key="${key//$'\n'/}"
  if [[ ! "$key" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo 'Vault root key must be exactly 64 hexadecimal characters.' >&2
    return 1
  fi

  printf '%s' "$key" > "$file"
  chmod 600 "$file"
  set_secret_file "$vault_name" "$file"
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

wait_for_secret_downloads() {
  local failed=0 pid
  for pid in "$@"; do
    if ! wait "$pid"; then
      failed=1
    fi
  done
  return "$failed"
}

download_mapped_secret_files() {
  local destination_dir="$1"
  local filename_mode="${2:-env}"
  local parallelism="${KEY_VAULT_DOWNLOAD_PARALLELISM:-8}"
  if [[ "$filename_mode" != 'env' && "$filename_mode" != 'vault' ]]; then
    echo "download filename mode must be env or vault" >&2
    return 64
  fi
  if [[ ! "$parallelism" =~ ^[1-9][0-9]*$ ]]; then
    echo "KEY_VAULT_DOWNLOAD_PARALLELISM must be a positive integer" >&2
    return 64
  fi

  mkdir -p "$destination_dir"
  chmod 700 "$destination_dir"
  load_key_vault_secret_names

  local pair vault_name env_name filename file
  local -a download_pids=()
  for pair in "${SECRET_MAP[@]}"; do
    vault_name="${pair%%:*}"
    env_name="${pair#*:}"
    if ! secret_exists "$vault_name"; then
      continue
    fi

    if [[ "$filename_mode" == 'env' ]]; then
      filename="$env_name"
    else
      filename="$vault_name"
    fi
    file="$destination_dir/$filename"
    (
      if ! az keyvault secret download \
        --vault-name "$AZURE_KEY_VAULT_NAME" \
        --name "$vault_name" \
        --file "$file" \
        --encoding utf-8 \
        --output none \
        --only-show-errors; then
        echo "::error::Failed to download mapped Key Vault secret: $vault_name"
        exit 1
      fi
      chmod 600 "$file"
    ) &
    download_pids+=("$!")

    if (( ${#download_pids[@]} >= parallelism )); then
      if ! wait_for_secret_downloads "${download_pids[@]}"; then
        return 1
      fi
      download_pids=()
    fi
  done

  if (( ${#download_pids[@]} > 0 )); then
    if ! wait_for_secret_downloads "${download_pids[@]}"; then
      return 1
    fi
  fi
}

download_kubernetes_secret() {
  : "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"
  local work_dir="$1"
  local secret_dir="$work_dir/kubernetes"
  mkdir -p "$secret_dir"
  chmod 700 "$secret_dir"
  download_mapped_secret_files "$secret_dir" env

  local required=(
    JWT_SECRET ANON_KEY SERVICE_ROLE_KEY SUPABASE_PUBLISHABLE_KEY
    SUPABASE_SECRET_KEY ANON_KEY_ASYMMETRIC SERVICE_ROLE_KEY_ASYMMETRIC
    JWT_KEYS JWT_JWKS POSTGRES_PASSWORD POSTGRES_PASSWORD_ENCODED POSTGRES_DB
    DASHBOARD_USERNAME DASHBOARD_PASSWORD SECRET_KEY_BASE REALTIME_DB_ENC_KEY
    VAULT_ENC_KEY VAULT_ROOT_KEY PG_META_CRYPTO_KEY S3_PROTOCOL_ACCESS_KEY_ID
    S3_PROTOCOL_ACCESS_KEY_SECRET AI_RECOVERY_CRON_URL
    AI_RECOVERY_CRON_PUBLISHABLE_KEY AI_RECOVERY_CRON_SECRET
    OPENAI_API_KEY OPENAI_PROJECT_ID
    OPENAI_WEBHOOK_SECRET AZURE_DOCUMENT_LAYOUT_ENABLED
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT AZURE_DOCUMENT_INTELLIGENCE_KEY
    CARBONE_API_TOKEN GOOGLE_API_KEY SMTP_ADMIN_EMAIL
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
  if [[ ! "$(<"$secret_dir/VAULT_ROOT_KEY")" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo '::error::VAULT_ROOT_KEY must be exactly 64 hexadecimal characters.'
    return 1
  fi

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
