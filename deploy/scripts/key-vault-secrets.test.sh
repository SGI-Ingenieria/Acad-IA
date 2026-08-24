#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

mkdir -p "$test_dir/bin"
cat > "$test_dir/bin/az" <<'MOCK_AZ'
#!/usr/bin/env bash
set -euo pipefail

operation="${1:-} ${2:-} ${3:-}"
case "$operation" in
  'keyvault secret list')
    calls=0
    [[ -f "$MOCK_AZ_LIST_CALLS" ]] && calls="$(<"$MOCK_AZ_LIST_CALLS")"
    printf '%s' "$((calls + 1))" > "$MOCK_AZ_LIST_CALLS"
    printf '%s\n' \
      jwt-secret openai-api-key smtp-host \
      azure-document-layout-enabled \
      azure-document-intelligence-endpoint \
      azure-document-intelligence-key
    ;;
  'keyvault secret download')
    name=''
    file=''
    while (( $# > 0 )); do
      case "$1" in
        --name)
          name="$2"
          shift 2
          ;;
        --file)
          file="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    if [[ "${MOCK_AZ_FAIL_NAME:-}" == "$name" ]]; then
      exit 1
    fi
    printf 'value-for-%s' "$name" > "$file"
    ;;
  *)
    echo "Unexpected az invocation: $operation" >&2
    exit 64
    ;;
esac
MOCK_AZ
chmod 755 "$test_dir/bin/az"

export PATH="$test_dir/bin:$PATH"
export MOCK_AZ_LIST_CALLS="$test_dir/list-calls"
export AZURE_KEY_VAULT_NAME='test-vault'
export KEY_VAULT_DOWNLOAD_PARALLELISM=2

# shellcheck source=key-vault-secrets.sh
source "$repo_root/deploy/scripts/key-vault-secrets.sh"

secret_exists jwt-secret
secret_exists openai-api-key
if secret_exists missing-secret; then
  echo 'secret_exists accepted a missing name' >&2
  exit 1
fi
[[ "$(<"$MOCK_AZ_LIST_CALLS")" == '1' ]]

download_mapped_secret_files "$test_dir/by-env" env
[[ "$(<"$test_dir/by-env/JWT_SECRET")" == 'value-for-jwt-secret' ]]
[[ "$(<"$test_dir/by-env/OPENAI_API_KEY")" == 'value-for-openai-api-key' ]]
[[ "$(<"$test_dir/by-env/SMTP_HOST")" == 'value-for-smtp-host' ]]
[[ "$(<"$test_dir/by-env/AZURE_DOCUMENT_LAYOUT_ENABLED")" == \
  'value-for-azure-document-layout-enabled' ]]
[[ "$(<"$test_dir/by-env/AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")" == \
  'value-for-azure-document-intelligence-endpoint' ]]
[[ "$(<"$test_dir/by-env/AZURE_DOCUMENT_INTELLIGENCE_KEY")" == \
  'value-for-azure-document-intelligence-key' ]]
[[ "$(stat --format '%a' "$test_dir/by-env/JWT_SECRET")" == '600' ]]

download_mapped_secret_files "$test_dir/by-vault" vault
[[ "$(<"$test_dir/by-vault/jwt-secret")" == 'value-for-jwt-secret' ]]
[[ "$(<"$MOCK_AZ_LIST_CALLS")" == '1' ]]

export MOCK_AZ_FAIL_NAME='openai-api-key'
if download_mapped_secret_files "$test_dir/failed-download" env \
  > "$test_dir/expected-download-error" 2>&1; then
  echo 'download_mapped_secret_files ignored a failed Azure download' >&2
  exit 1
fi
grep --fixed-strings --quiet \
  'Failed to download mapped Key Vault secret: openai-api-key' \
  "$test_dir/expected-download-error"
unset MOCK_AZ_FAIL_NAME

echo 'Key Vault secret cache and parallel downloads passed.'
