#!/usr/bin/env bash
set -euo pipefail

readonly SOURCE_CERT="${PORTAINER_SOURCE_CERT:-/var/lib/docker/volumes/npm_ssl/_data/live/npm-2/fullchain.pem}"
readonly SOURCE_KEY="${PORTAINER_SOURCE_KEY:-/var/lib/docker/volumes/npm_ssl/_data/live/npm-2/privkey.pem}"
readonly DESTINATION_DIR="${PORTAINER_CERT_DIR:-/var/lib/docker/volumes/portainer_data/_data/certs}"
readonly EXPECTED_DNS="${PORTAINER_EXPECTED_DNS:-portainer.apps.lci.ulsa.mx}"
readonly CONTAINER_NAME="${PORTAINER_CONTAINER_NAME:-portainer}"
readonly HTTPS_PORT="${PORTAINER_HTTPS_PORT:-9443}"
readonly DESTINATION_CERT="${DESTINATION_DIR}/cert.pem"
readonly DESTINATION_KEY="${DESTINATION_DIR}/key.pem"
readonly BACKUP_DIR="${DESTINATION_DIR}/backups"

require_file() {
  local path="$1"
  if [[ ! -s "$path" ]]; then
    printf 'Required certificate file is missing: %s\n' "$path" >&2
    exit 1
  fi
}

require_file "$SOURCE_CERT"
require_file "$SOURCE_KEY"
openssl x509 -in "$SOURCE_CERT" -noout -checkend 604800 >/dev/null
openssl x509 -in "$SOURCE_CERT" -noout -ext subjectAltName |
  grep -Fq "DNS:${EXPECTED_DNS}"

cert_public_key="$(openssl x509 -in "$SOURCE_CERT" -pubkey -noout | openssl sha256)"
key_public_key="$(openssl pkey -in "$SOURCE_KEY" -pubout 2>/dev/null | openssl sha256)"
if [[ "$cert_public_key" != "$key_public_key" ]]; then
  printf 'The certificate and private key do not match.\n' >&2
  exit 1
fi

if [[ -s "$DESTINATION_CERT" && -s "$DESTINATION_KEY" ]] &&
  cmp -s "$SOURCE_CERT" "$DESTINATION_CERT" &&
  cmp -s "$SOURCE_KEY" "$DESTINATION_KEY"; then
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
backup_cert="${BACKUP_DIR}/cert.pem.${timestamp}"
backup_key="${BACKUP_DIR}/key.pem.${timestamp}"
had_cert=false
had_key=false

if [[ -s "$DESTINATION_CERT" ]]; then
  cp -p "$DESTINATION_CERT" "$backup_cert"
  had_cert=true
fi
if [[ -s "$DESTINATION_KEY" ]]; then
  cp -p "$DESTINATION_KEY" "$backup_key"
  had_key=true
fi

restore_previous_certificate() {
  if [[ "$had_cert" == true ]]; then
    cp -p "$backup_cert" "$DESTINATION_CERT"
  else
    rm -f "$DESTINATION_CERT"
  fi
  if [[ "$had_key" == true ]]; then
    cp -p "$backup_key" "$DESTINATION_KEY"
  else
    rm -f "$DESTINATION_KEY"
  fi
  docker restart "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

cert_tmp="${DESTINATION_DIR}/.cert.pem.${timestamp}.tmp"
key_tmp="${DESTINATION_DIR}/.key.pem.${timestamp}.tmp"
trap 'rm -f "$cert_tmp" "$key_tmp"' EXIT
install -m 0644 "$SOURCE_CERT" "$cert_tmp"
install -m 0600 "$SOURCE_KEY" "$key_tmp"
mv -f "$cert_tmp" "$DESTINATION_CERT"
mv -f "$key_tmp" "$DESTINATION_KEY"

if ! docker restart "$CONTAINER_NAME" >/dev/null; then
  restore_previous_certificate
  exit 1
fi

for _ in {1..30}; do
  if curl -kfsS --connect-timeout 2 \
    "https://127.0.0.1:${HTTPS_PORT}/api/status" >/dev/null; then
    exit 0
  fi
  sleep 2
done

restore_previous_certificate
exit 1
