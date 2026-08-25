#!/usr/bin/env bash
set -euo pipefail

: "${AKS_NAMESPACE:?AKS_NAMESPACE is required}"

readonly SOURCE_PVC='acad-ia-backend-supabase-snippets-standard-v1'
readonly TARGET_PVC='acad-ia-backend-supabase-functions-snippets-standard-v1'
readonly JOB_NAME='acad-ia-functions-snippets-pvc-migration'

kubectl get pvc "$TARGET_PVC" --namespace "$AKS_NAMESPACE" >/dev/null
if ! kubectl get pvc "$SOURCE_PVC" --namespace "$AKS_NAMESPACE" >/dev/null 2>&1; then
  echo 'The legacy Functions/snippets PVC is already absent; migration is not required.'
  exit 0
fi

kubectl delete job "$JOB_NAME" \
  --namespace "$AKS_NAMESPACE" \
  --ignore-not-found \
  --wait >/dev/null

kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: $JOB_NAME
  namespace: $AKS_NAMESPACE
  labels:
    app.kubernetes.io/name: acad-ia-backend
    app.kubernetes.io/component: functions-snippets-migration
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: acad-ia-backend
        app.kubernetes.io/component: functions-snippets-migration
    spec:
      automountServiceAccountToken: false
      restartPolicy: Never
      securityContext:
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: migrate
          image: alpine:3.22.1
          imagePullPolicy: IfNotPresent
          command: ['/bin/sh', '-c']
          args:
            - |
              set -eu
              if [ -f /target/.acad-ia-workspace-migrated ]; then
                echo 'Functions/snippets workspace was already migrated.'
                exit 0
              fi
              cp -R /source/. /target/
              touch /target/.acad-ia-workspace-migrated
              test -d /target/functions || true
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 100m
              memory: 64Mi
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ['ALL']
          volumeMounts:
            - name: source
              mountPath: /source
              readOnly: true
            - name: target
              mountPath: /target
      volumes:
        - name: source
          persistentVolumeClaim:
            claimName: $SOURCE_PVC
        - name: target
          persistentVolumeClaim:
            claimName: $TARGET_PVC
EOF

if ! kubectl wait \
  --for=condition=complete \
  "job/$JOB_NAME" \
  --namespace "$AKS_NAMESPACE" \
  --timeout=5m; then
  kubectl logs "job/$JOB_NAME" --namespace "$AKS_NAMESPACE" || true
  exit 1
fi

kubectl logs "job/$JOB_NAME" --namespace "$AKS_NAMESPACE"
kubectl delete job "$JOB_NAME" --namespace "$AKS_NAMESPACE" --wait >/dev/null
