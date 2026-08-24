#!/usr/bin/env bash
set -euo pipefail

: "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"
: "${FUNCTIONS_SOURCE_REVISION:?FUNCTIONS_SOURCE_REVISION is required}"

readonly RETAINED="${FUNCTIONS_SOURCE_RETAINED:-5}"

if [[ ! "$FUNCTIONS_SOURCE_REVISION" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'FUNCTIONS_SOURCE_REVISION must be a full lowercase Git SHA.\n' >&2
  exit 1
fi
if [[ ! "$RETAINED" =~ ^[1-9][0-9]*$ ]]; then
  printf 'FUNCTIONS_SOURCE_RETAINED must be a positive integer.\n' >&2
  exit 1
fi

current="acad-ia-functions-source-${FUNCTIONS_SOURCE_REVISION:0:32}"
mapfile -t ordered < <(
  kubectl get configmap \
    --namespace "$AKS_NAMESPACE" \
    --selector 'app.kubernetes.io/component=functions-source' \
    -o json |
    jq -r '.items
      | sort_by(.metadata.creationTimestamp)
      | reverse
      | .[].metadata.name'
)

keep=("$current")
for name in "${ordered[@]}"; do
  [[ "$name" =~ ^acad-ia-functions-source-[0-9a-f]{32}$ ]] || continue
  [[ "$name" == "$current" ]] && continue
  if (( ${#keep[@]} < RETAINED )); then
    keep+=("$name")
  fi
done

for name in "${ordered[@]}"; do
  [[ "$name" =~ ^acad-ia-functions-source-[0-9a-f]{32}$ ]] || continue
  retained=false
  for kept in "${keep[@]}"; do
    if [[ "$name" == "$kept" ]]; then
      retained=true
      break
    fi
  done
  if [[ "$retained" == false ]]; then
    kubectl delete configmap "$name" --namespace "$AKS_NAMESPACE"
  fi
done
