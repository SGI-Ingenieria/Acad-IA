#!/usr/bin/env bash
set -euo pipefail

check_only=false
if [[ "${1:-}" == '--check' ]]; then
  check_only=true
  shift
fi
readonly check_only
readonly chart_package="${1:-deploy/helm/acad-ia-backend/charts/supabase-0.7.2.tgz}"
readonly expected_fields=13

if [[ ! -f "$chart_package" ]]; then
  printf 'Supabase chart package not found: %s\n' "$chart_package" >&2
  exit 66
fi

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT
mkdir "$work_dir/chart"
tar -xzf "$chart_package" -C "$work_dir/chart"

values_file="$work_dir/chart/supabase/values.yaml"
if [[ ! -f "$values_file" ]]; then
  printf 'The package does not contain supabase/values.yaml.\n' >&2
  exit 65
fi

map_mounts="$(grep -F -c 'volumeMounts: {}' "$values_file" || true)"
map_volumes="$(grep -F -c 'volumes: {}' "$values_file" || true)"
list_mounts="$(grep -F -c 'volumeMounts: []' "$values_file" || true)"
list_volumes="$(grep -F -c 'volumes: []' "$values_file" || true)"

if [[ "$map_mounts" == 0 && "$map_volumes" == 0 && \
  "$list_mounts" == "$expected_fields" && "$list_volumes" == "$expected_fields" ]]; then
  printf 'Supabase chart list defaults are already patched.\n'
  exit 0
fi

if [[ "$check_only" == true ]]; then
  printf 'The vendored Supabase chart still contains map-shaped volume defaults.\n' >&2
  printf 'Run deploy/scripts/patch-vendored-supabase-chart.sh and commit the package.\n' >&2
  exit 1
fi

if [[ "$map_mounts" != "$expected_fields" || "$map_volumes" != "$expected_fields" ]]; then
  printf 'Unexpected upstream values shape: volumeMounts maps=%s, volumes maps=%s.\n' \
    "$map_mounts" "$map_volumes" >&2
  printf 'Review the new chart before updating the vendored patch.\n' >&2
  exit 65
fi

# Kubernetes PodSpec volumeMounts and volumes are arrays. The upstream chart
# renders these values with toYaml but declares their empty defaults as maps,
# which makes Helm coalescing warn whenever a consumer supplies real entries.
sed -i \
  -e 's/volumeMounts: {}/volumeMounts: []/' \
  -e 's/volumes: {}/volumes: []/' \
  "$values_file"

test "$(grep -F -c 'volumeMounts: []' "$values_file")" = "$expected_fields"
test "$(grep -F -c 'volumes: []' "$values_file")" = "$expected_fields"
if grep -F -q -e 'volumeMounts: {}' -e 'volumes: {}' "$values_file"; then
  printf 'Map-shaped volume defaults remain after patching.\n' >&2
  exit 65
fi

patched_package="$work_dir/$(basename "$chart_package")"
tar \
  --sort=name \
  --mtime='@0' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -czf "$patched_package" \
  -C "$work_dir/chart" \
  supabase
mv -- "$patched_package" "$chart_package"
printf 'Patched list defaults in %s.\n' "$chart_package"
