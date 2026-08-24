#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$BRANCH_NAME" || -z "$PARENT_PROJECT_REF" ]]; then
  echo '::error::Faltan el nombre de la branch o el project ref principal de Supabase.'
  exit 1
fi

if [[ "$TARGET_STATE" != 'active' && "$TARGET_STATE" != 'paused' ]]; then
  echo '::error::target-state debe ser active o paused.'
  exit 1
fi

if [[ ! "$WAIT_SECONDS" =~ ^[0-9]+$ ]] || (( WAIT_SECONDS < 1 )); then
  echo '::error::wait-seconds debe ser un entero positivo.'
  exit 1
fi

if [[ -n "${GITHUB_ACTIONS:-}" && -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo '::error::Falta SUPABASE_ACCESS_TOKEN.'
  exit 1
fi

branches_json="$(mktemp)"
cli_error="$(mktemp)"
trap 'rm -f "$branches_json" "$cli_error"' EXIT

deadline=$((SECONDS + WAIT_SECONDS))
branch_seen=0
api_failures=0
last_request_at=-120
last_state=''
last_missing_report=-60

finish() {
  local project_ref="$1"
  local project_status="$2"

  {
    printf 'project-ref=%s\n' "$project_ref"
    printf 'status=%s\n' "$project_status"
  } >> "$GITHUB_OUTPUT"
  echo "Supabase $BRANCH_NAME quedo en $project_status."
  exit 0
}

request_transition() {
  local command="$1"

  if (( SECONDS - last_request_at < 60 )); then
    return 0
  fi

  last_request_at=$SECONDS
  if supabase branches "$command" "$BRANCH_NAME" \
    --project-ref "$PARENT_PROJECT_REF" \
    --yes > /dev/null 2> "$cli_error"; then
    echo "Supabase acepto la solicitud de $command para $BRANCH_NAME."
  else
    echo "::warning::Supabase aun no acepto $command para $BRANCH_NAME; se reintentara."
  fi
}

while (( SECONDS <= deadline )); do
  if ! supabase branches list \
    --project-ref "$PARENT_PROJECT_REF" \
    -o json > "$branches_json" 2> "$cli_error"; then
    api_failures=$((api_failures + 1))
    if (( api_failures >= 5 )); then
      echo '::error::Supabase Branching no respondio despues de cinco intentos.'
      exit 1
    fi
  else
    api_failures=0
    branch_record="$(
      jq -c --arg branch "$BRANCH_NAME" \
        '[.[] | select(.is_default != true and (.git_branch == $branch or .name == $branch))] | first // empty' \
        < "$branches_json"
    )"

    if [[ -z "$branch_record" ]]; then
      if (( SECONDS - last_missing_report >= 60 )); then
        echo "Esperando que la integracion de Supabase cree la branch $BRANCH_NAME..."
        last_missing_report=$SECONDS
      fi
    else
      branch_seen=1
      workflow_status="$(jq -r '.status // "UNKNOWN"' <<< "$branch_record")"
      project_status="$(jq -r '.preview_project_status // "UNKNOWN"' <<< "$branch_record")"
      preview_project_ref="$(jq -r '.project_ref // empty' <<< "$branch_record")"
      current_state="$workflow_status/$project_status"

      if [[ "$current_state" != "$last_state" ]]; then
        echo "Supabase $BRANCH_NAME: workflow=$workflow_status, project=$project_status."
        last_state="$current_state"
      fi

      workflow_failed=false
      if [[ "$workflow_status" == *FAILED* || "$workflow_status" == *ERROR* ]]; then
        workflow_failed=true
      fi

      if [[ "$TARGET_STATE" == 'active' ]]; then
        if [[ "$workflow_failed" == 'true' ]]; then
          echo "::error::La provision de Supabase termino en $workflow_status; Azure no se desplegara."
          exit 1
        fi

        case "$project_status" in
          INACTIVE)
            request_transition unpause
            ;;
          ACTIVE_HEALTHY)
            if [[ "$workflow_status" == 'FUNCTIONS_DEPLOYED' ]]; then
              finish "$preview_project_ref" "$project_status"
            fi
            ;;
          PAUSING | COMING_UP | RESTORING | CREATING_PROJECT | UNKNOWN)
            ;;
          *)
            ;;
        esac
      else
        provision_finished=false
        if [[ "$workflow_status" == 'FUNCTIONS_DEPLOYED' || "$workflow_failed" == 'true' ]]; then
          provision_finished=true
        fi

        if [[ "$provision_finished" == 'true' ]]; then
          case "$project_status" in
            INACTIVE)
              finish "$preview_project_ref" "$project_status"
              ;;
            ACTIVE_HEALTHY)
              request_transition pause
              ;;
            PAUSING | COMING_UP | RESTORING | CREATING_PROJECT | UNKNOWN)
              ;;
            *)
              ;;
          esac
        fi
      fi
    fi
  fi

  if (( SECONDS + 10 > deadline )); then
    break
  fi
  sleep 10
done

if [[ "$branch_seen" == '0' ]]; then
  echo "::error::La integracion no creo la branch Supabase $BRANCH_NAME en ${WAIT_SECONDS}s."
else
  echo "::error::La branch Supabase $BRANCH_NAME no alcanzo el estado $TARGET_STATE en ${WAIT_SECONDS}s."
fi
exit 1
