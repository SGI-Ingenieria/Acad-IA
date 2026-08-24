#!/usr/bin/env bash
set -euo pipefail

: "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"

readonly job_name='acad-ia-sync-ai-recovery-vault'

kubectl delete job "$job_name" \
  --namespace "$AKS_NAMESPACE" \
  --ignore-not-found \
  --wait=true >/dev/null

kubectl apply --namespace "$AKS_NAMESPACE" -f - <<'YAML'
apiVersion: batch/v1
kind: Job
metadata:
  name: acad-ia-sync-ai-recovery-vault
  labels:
    app.kubernetes.io/name: acad-ia-backend
    app.kubernetes.io/component: ai-recovery-vault-sync
spec:
  backoffLimit: 2
  ttlSecondsAfterFinished: 600
  template:
    metadata:
      labels:
        app.kubernetes.io/name: acad-ia-backend
        app.kubernetes.io/component: ai-recovery-vault-sync
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      containers:
        - name: sync
          image: postgres:17-alpine
          imagePullPolicy: IfNotPresent
          envFrom:
            - secretRef:
                name: acad-ia-backend-secrets
          command: ['/bin/sh', '-ec']
          args:
            - |
              waited=0
              until pg_isready --host supabase-db --port 5432 --username postgres --dbname "$POSTGRES_DB" >/dev/null 2>&1; do
                if [ "$waited" -ge 300 ]; then
                  echo 'Postgres was not ready after 300s' >&2
                  exit 1
                fi
                sleep 2
                waited=$((waited + 2))
              done

              export PGPASSWORD="$POSTGRES_PASSWORD"
              psql \
                --host supabase-db \
                --port 5432 \
                --username postgres \
                --dbname "$POSTGRES_DB" \
                --quiet \
                --set ON_ERROR_STOP=1 \
                --set recovery_url="$AI_RECOVERY_CRON_URL" \
                --set recovery_publishable_key="$AI_RECOVERY_CRON_PUBLISHABLE_KEY" \
                --set recovery_secret="$AI_RECOVERY_CRON_SECRET" >/dev/null <<'SQL'
              begin;
              delete from vault.secrets
              where name in (
                'AI_RECOVERY_CRON_URL',
                'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
                'AI_RECOVERY_CRON_SECRET'
              );
              select vault.create_secret(:'recovery_url', 'AI_RECOVERY_CRON_URL');
              select vault.create_secret(:'recovery_publishable_key', 'AI_RECOVERY_CRON_PUBLISHABLE_KEY');
              select vault.create_secret(:'recovery_secret', 'AI_RECOVERY_CRON_SECRET');
              select cron.alter_job(job_id := jobid, active := true)
              from cron.job
              where jobname in (
                'limpiar-paquetes-aprendizaje-diaria',
                'recuperar-generaciones-ia-5m'
              );
              commit;
              SQL
              echo 'AI recovery Vault values and schedules synchronized.'
          resources:
            requests:
              cpu: 25m
              memory: 64Mi
            limits:
              cpu: 250m
              memory: 256Mi
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ['ALL']
YAML

if ! kubectl wait \
  --for=condition=complete \
  "job/$job_name" \
  --namespace "$AKS_NAMESPACE" \
  --timeout=7m; then
  kubectl logs "job/$job_name" --namespace "$AKS_NAMESPACE" --all-containers || true
  exit 1
fi

kubectl logs "job/$job_name" --namespace "$AKS_NAMESPACE" --all-containers
kubectl delete job "$job_name" \
  --namespace "$AKS_NAMESPACE" \
  --wait=true >/dev/null
