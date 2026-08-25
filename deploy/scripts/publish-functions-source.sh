#!/usr/bin/env bash
set -euo pipefail

: "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"
: "${FUNCTIONS_SOURCE_REVISION:?FUNCTIONS_SOURCE_REVISION is required}"

readonly PVC_NAME="${FUNCTIONS_SOURCE_PVC:-acad-ia-backend-supabase-functions-snippets-standard-v1}"
readonly CONFIG_MAP_NAME="acad-ia-functions-source-${FUNCTIONS_SOURCE_REVISION:0:32}"

if [[ ! "$FUNCTIONS_SOURCE_REVISION" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'FUNCTIONS_SOURCE_REVISION must be a full lowercase Git SHA.\n' >&2
  exit 1
fi

kubectl get namespace "$AKS_NAMESPACE" >/dev/null
kubectl get pvc "$PVC_NAME" --namespace "$AKS_NAMESPACE" >/dev/null

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
bundle="$work_dir/functions.tar.gz"
FUNCTIONS_BUNDLE_MAX_BYTES=900000 \
  GITHUB_OUTPUT='' \
  bash deploy/scripts/package-functions-source.sh "$FUNCTIONS_SOURCE_REVISION" "$bundle" \
  >/dev/null

bundle_sha="$(sha256sum "$bundle" | cut -d ' ' -f 1)"
bundle_size="$(stat -c '%s' "$bundle")"

if kubectl get configmap "$CONFIG_MAP_NAME" --namespace "$AKS_NAMESPACE" >/dev/null 2>&1; then
  existing_sha="$(kubectl get configmap "$CONFIG_MAP_NAME" \
    --namespace "$AKS_NAMESPACE" \
    -o jsonpath='{.metadata.annotations.acad-ia\.ulsa\.mx/bundle-sha256}')"
  if [[ "$existing_sha" != "$bundle_sha" ]]; then
    printf 'Existing immutable ConfigMap %s has an unexpected digest.\n' "$CONFIG_MAP_NAME" >&2
    exit 1
  fi
else
  kubectl create configmap "$CONFIG_MAP_NAME" \
    --namespace "$AKS_NAMESPACE" \
    --from-file="functions.tar.gz=$bundle" \
    --dry-run=client \
    -o json |
    jq \
      --arg revision "$FUNCTIONS_SOURCE_REVISION" \
      --arg sha "$bundle_sha" \
      '.immutable = true
       | .metadata.labels["app.kubernetes.io/name"] = "acad-ia-backend"
       | .metadata.labels["app.kubernetes.io/component"] = "functions-source"
       | .metadata.labels["app.kubernetes.io/managed-by"] = "github-actions"
       | .metadata.annotations["acad-ia.ulsa.mx/source-revision"] = $revision
       | .metadata.annotations["acad-ia.ulsa.mx/bundle-sha256"] = $sha' |
    kubectl create -f - >/dev/null
fi

previous_revision="$(kubectl get deployment acad-ia-functions \
  --namespace "$AKS_NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="FUNCTIONS_SOURCE_REVISION")].value}' \
  2>/dev/null || true)"
if [[ ! "$previous_revision" =~ ^[0-9a-f]{40}$ ]]; then
  previous_revision=''
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'config_map_name=%s\n' "$CONFIG_MAP_NAME"
    printf 'bundle_sha256=%s\n' "$bundle_sha"
    printf 'bundle_bytes=%s\n' "$bundle_size"
    printf 'previous_revision=%s\n' "$previous_revision"
  } >> "$GITHUB_OUTPUT"
else
  printf 'config_map_name=%s\nbundle_sha256=%s\nbundle_bytes=%s\nprevious_revision=%s\n' \
    "$CONFIG_MAP_NAME" "$bundle_sha" "$bundle_size" "$previous_revision"
fi
