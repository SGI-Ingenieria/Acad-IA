# Backend de Acad-IA en AKS

Este paquete prepara Supabase self-hosted para producción en AKS sin desplegar
el frontend. El frontend conserva su publicación en Azure Static Web Apps y se
compila contra el hostname de AKS sólo después de que el workflow del backend
termina correctamente.

La instancia administrada de Supabase se conserva únicamente para preview y
QA. Producción usa el Postgres, Auth, REST, Realtime, Storage y Edge Runtime de
este chart.

## Arquitectura preparada

- Supabase self-hosted `v0.8.0`, con las imágenes fijadas a las versiones
  publicadas el 11 de agosto de 2026.
- Envoy `v1.39.0` como único API gateway. No se despliega Kong.
- Postgres 17 en Azure Disk Premium.
- Storage oficial con `STORAGE_BACKEND=file` en un Azure Disk Premium retenido
  por Helm. No se usa MinIO ni un S3 externo como almacenamiento primario.
- `storage-api` e `imgproxy` comparten el PVC y ejecutan una réplica con
  estrategia `Recreate`, coherente con `ReadWriteOnce`.
- Edge Functions empaquetadas en una imagen propia, con JWT obligatorio salvo
  la lista pública auditada por el router.
- Supavisor, migraciones, probes, recursos, PDB e Ingress TLS.
- CronJob semanal de respaldo hacia RustFS.

El chart padre envuelve `supabase-community/supabase-kubernetes` 0.7.2 y
reemplaza las piezas que requieren el comportamiento actual de Acad-IA. No usa
el Operator `core.supabase.io/v1alpha1`: su API todavía es temprana para la
inyección de secretos y el ciclo de migraciones requerido aquí.

No use el asistente de Azure Portal que genera un Dockerfile Node y un Service
`LoadBalancer` en el puerto 3000. Supabase es un conjunto de servicios; sólo
Envoy queda detrás del Ingress. Postgres, Auth, REST, Realtime, Storage,
Functions, Meta, Studio y Supavisor permanecen privados como `ClusterIP`.

## Webhook de OpenAI

OpenAI debe enviar directamente a:

```text
https://<AKS_BACKEND_HOST>/functions/v1/openai-webhook-responses
```

Configure los eventos `response.completed`, `response.cancelled`,
`response.failed` y `response.incomplete`. La Edge Function conserva el cuerpo
sin transformar y valida la firma mediante `client.webhooks.unwrap` y
`OPENAI_WEBHOOK_SECRET`.

No existe un receptor HTTP independiente. Envoy permite la ruta de Functions y
el router exime de JWT únicamente ese nombre; la firma de OpenAI sigue siendo
la frontera de autenticación. La comprobación posterior al despliegue envía una
solicitud sin firma y exige HTTP 400.

## GitHub environments

Use el environment `production` para AKS y Azure Static Web Apps. Configure
required reviewers para que el job de despliegue no continúe sin aprobación.
Los workflows de preview existentes continúan usando el proyecto administrado
de Supabase y no comparten secretos con producción.

Variables del environment `production`:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
AZURE_KEY_VAULT_NAME
ACR_NAME
ACR_LOGIN_SERVER
AKS_RESOURCE_GROUP
AKS_CLUSTER_NAME
AKS_NAMESPACE
AKS_BACKEND_HOST
FRONTEND_URL
RUSTFS_ENDPOINT
APP_GITHUB_OWNER
APP_GITHUB_REPO
```

Secrets externos del environment `production`:

```text
OPENAI_API_KEY
OPENAI_PROJECT_ID
OPENAI_WEBHOOK_SECRET
CARBONE_API_TOKEN
GOOGLE_API_KEY
SMTP_ADMIN_EMAIL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_SENDER_NAME
SGU_NTLM_URL
GITHUB_APP_ID
GITHUB_APP_INSTALLATION_ID
GITHUB_APP_PRIVATE_KEY
RUSTFS_ACCESS_KEY_ID
RUSTFS_SECRET_ACCESS_KEY
AZURE_SWA_DEPLOYMENT_TOKEN
```

La identidad OIDC de GitHub necesita `AcrPush`, permisos acotados sobre AKS y
permisos para leer/escribir secretos en el Key Vault seleccionado. El clúster
debe tener autorización para extraer imágenes de ACR.

## Key Vault y bootstrap

Azure Key Vault es la fuente operativa de verdad y el lugar para inspección o
hot-fix. El workflow del backend hace lo siguiente:

1. En la primera ejecución, si no existe ninguna clave estructural, genera de
   forma coherente JWT legacy, JWKS ES256, claves API opacas, Postgres,
   Dashboard, Supavisor y secretos internos.
2. Si encuentra un bootstrap parcial, falla sin sobrescribirlo.
3. Copia desde GitHub únicamente los secretos externos ausentes.
4. Sincroniza Key Vault al Secret `acad-ia-backend-secrets` justo antes de Helm.

Un commit normal nunca rota credenciales y tampoco revierte un hot-fix de Key
Vault. Para reemplazar secretos externos desde GitHub, ejecute manualmente
`Backend AKS` con `sync_external_secrets=true`.

Vaultwarden no participa en este flujo. No se deben automatizar inicios de
sesión personales ni copiar sus credenciales al repositorio o a Actions.

## Rotación manual

Ejecute `Rotate backend secrets` desde **Actions → Run workflow**. Sus alcances
son:

- `safe`: claves API opacas y contraseña del Dashboard; confirmación `ROTATE`.
- `api-keys`: sólo claves `sb_publishable` y `sb_secret`; confirmación `ROTATE`.
- `dashboard`: sólo contraseña del Dashboard; confirmación `ROTATE`.
- `application`: secretos internos de Acad-IA; confirmación
  `ROTATE_APPLICATION`.
- `identity`: par ES256, API keys y JWKS; confirmación `ROTATE_IDENTITY`.

El alcance `identity` conserva `JWT_SECRET`, pero invalida las sesiones firmadas
con el par ES256 anterior. Los alcances que cambian la clave pública vuelven a
ejecutar el workflow del frontend para compilar Azure Static Web Apps con la
clave vigente.

`POSTGRES_PASSWORD` y `JWT_SECRET` no se rotan con este workflow: requieren una
ventana de mantenimiento, actualización coordinada de consumidores y un plan
de recuperación probado.

El generador escribe en archivos temporales con permisos restrictivos y las
operaciones de Azure CLI usan `--file`; ningún workflow imprime los valores.

## Imágenes y migraciones

GitHub Actions construye tres imágenes:

- `acad-ia-functions`: Edge Functions y router por función.
- `acad-ia-migrator`: Supabase CLI 2.115.0, migraciones y seed idempotente.
- `acad-ia-backup`: cliente Postgres, `rclone` y el procedimiento de respaldo.

El Job de Helm ejecuta `supabase migration up --include-all` y después el seed.
Las migraciones no se revierten automáticamente al revertir workloads; deben
ser compatibles hacia atrás o incluir un rollback probado.

## Storage y respaldos

Storage usa un PVC `managed-csi-premium`, `ReadWriteOnce`, de 128 GiB. La
anotación `helm.sh/resource-policy: keep` evita que Helm elimine el volumen al
desinstalar la release. Antes de eliminar recursos de Azure, verifique siempre
el PVC y su Disk administrado.

El CronJob corre los domingos a las 03:00 en `America/Mexico_City` y escribe en:

```text
Respaldos/acad-ia/supabase-production/<año>-W<semana>/<timestamp>/
```

Cada carpeta contiene:

```text
roles.sql
schema.sql
data.sql
storage.tar.gz
SHA256SUMS
manifest.txt
```

El endpoint se obtiene de `RUSTFS_ENDPOINT`; las credenciales se leen sólo del
Secret sincronizado desde Key Vault. RustFS es destino de respaldo, no backend
primario de Supabase Storage.

El dump de Postgres y el archivo del PVC no constituyen una instantánea atómica
entre base y objetos. Para un RPO estricto, complemente este respaldo lógico con
Azure Backup/snapshots coordinados y pruebe restauraciones periódicas en un
namespace aislado.

El workflow histórico `.github/workflows/supabase-update.yaml` respalda el
proyecto administrado de preview; no cubre Postgres ni Storage de AKS.

## Preparación previa del clúster

Antes del primer despliegue deben existir:

1. AKS con OIDC/Workload Identity y ACR asociado.
2. Ingress Web App Routing —o el controller elegido— y TLS.
3. Azure Key Vault con RBAC para la identidad federada de GitHub.
4. Azure Monitor/Container Insights y Managed Prometheus según el estándar de
   la plataforma.
5. El bucket `Respaldos` en RustFS y una prueba de escritura con las
   credenciales de producción.
6. Required reviewers en el environment `production`.

El chart desactiva Logflare y Vector. Los contenedores escriben a
`stdout`/`stderr` y AKS recolecta los logs; no se monta el socket de Docker.

Postgres se despliega inicialmente como instancia única. El Azure Disk aporta
persistencia, no alta disponibilidad. Defina RTO/RPO y, si se necesita HA,
migre a un Postgres replicado compatible después de validar extensiones, roles,
webhooks y Realtime.

Un volumen existente de Postgres 15 no se puede conectar directamente a la
imagen 17. La migración desde la instancia actual requiere dump/restore probado
y una ventana de corte.

## Validación local

```bash
node --test deploy/scripts/generate-supabase-secrets.test.mjs
docker compose --env-file .env.example config --quiet
helm repo add supabase-community \
  https://supabase-community.github.io/supabase-kubernetes
helm dependency build deploy/helm/acad-ia-backend
helm lint deploy/helm/acad-ia-backend \
  -f deploy/helm/acad-ia-backend/values-production.example.yaml
helm template acad-ia-backend deploy/helm/acad-ia-backend \
  --namespace acad-ia-backend \
  -f deploy/helm/acad-ia-backend/values-production.example.yaml
```

## Acceso operativo

No exponga Postgres, Meta ni Studio mediante Services públicos. Use RBAC,
acceso privado y, para diagnóstico puntual:

```bash
kubectl -n acad-ia-backend port-forward svc/supabase-envoy 8000:8000
kubectl -n acad-ia-backend logs deploy/supabase-envoy
kubectl -n acad-ia-backend logs deploy/acad-ia-functions
kubectl -n acad-ia-backend get pods,svc,ingress,cronjob,pvc
```

## Credenciales previamente expuestas

Una API key de Google y otros valores con apariencia de credencial estuvieron
en archivos o documentos compartidos durante esta preparación. Eliminarlos del
árbol actual no los revoca ni borra del historial. Deben rotarse en sus
proveedores antes de habilitar producción. No copie al repositorio ningún valor
del documento adjunto.
