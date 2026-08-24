# Backend de Acad-IA en AKS

Este paquete prepara Supabase self-hosted para producción en AKS sin desplegar
el frontend. GitHub Pages es el sitio de pruebas; los sitios temporales de Azure
Static Web Apps creados por pull request son staging y permanecen intactos. Un
único workflow de release detecta qué cambió: reconcilia AKS sólo para cambios
del backend y llama al workflow reutilizable del sitio productivo únicamente
para cambios del frontend. Si ambos cambiaron, el frontend espera a que AKS
termine correctamente.

La instancia administrada de Supabase se conserva únicamente para testing,
staging y QA. Producción usa el Postgres, Auth, REST, Realtime, Storage y Edge
Runtime de este chart.

## Arquitectura preparada

- Supabase self-hosted `v0.8.0`, con las imágenes fijadas a las versiones
  publicadas el 11 de agosto de 2026.
- Envoy `v1.39.0` como único API gateway. No se despliega Kong.
- Postgres 17 en un Azure Disk Standard SSD de 16 GiB.
- Storage oficial con `STORAGE_BACKEND=file` en un Azure Disk Standard SSD de
  32 GiB. No se usa MinIO ni un S3 externo como almacenamiento primario.
- `storage-api` e `imgproxy` comparten el PVC y ejecutan una réplica con
  estrategia `Recreate`, coherente con `ReadWriteOnce`.
- Edge Runtime oficial `v1.74.3`, fijado también por digest, con JWT obligatorio
  salvo la lista pública auditada por el router.
- Supavisor, migraciones, probes, recursos, PDB e Ingress TLS.
- TLS público automatizado con cert-manager 1.21.1 y Let's Encrypt.
- CronJob semanal de respaldo hacia RustFS con retención de 84 días.
- GitHub empaqueta sólo el código de Functions en un ConfigMap inmutable. Un Job
  de Helm lo valida y lo instala como revisión de sólo lectura en el PVC de
  snippets que Studio ya utiliza; Edge Runtime y Studio montan la misma
  revisión. Se conservan cinco revisiones para rollback.

El chart padre envuelve `supabase-community/supabase-kubernetes` 0.7.2 y
reemplaza las piezas que requieren el comportamiento actual de Acad-IA. No usa
el Operator `core.supabase.io/v1alpha1`: su API todavía es temprana para la
inyección de secretos y el ciclo de migraciones requerido aquí.

No use el asistente de Azure Portal que genera un Dockerfile Node y un Service
`LoadBalancer` en el puerto 3000. Supabase es un conjunto de servicios; sólo
Envoy queda detrás del Ingress. Postgres, Auth, REST, Realtime, Storage,
Functions, Meta, Studio y Supavisor permanecen privados como `ClusterIP`.

El Dashboard sigue protegido por Basic Auth en Envoy. La única excepción
estática adicional es la ruta exacta `/favicon/manifest.json`: los navegadores
solicitan el Web App Manifest sin reenviar esas credenciales y Studio lo
necesita para representar correctamente sus páginas. No se abre el prefijo
`/favicon/` ni ninguna API de Studio.

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

Los tres niveles quedan separados de esta forma:

- `testing`: compila GitHub Pages desde `main` contra la instancia administrada
  de Supabase destinada a pruebas. Configure aquí `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY`.
- `preview`: se conserva como nombre técnico del environment ya configurado
  para no romper secretos ni protecciones existentes. Sus deployments de Azure
  Static Web Apps por pull request son el nivel **staging**.
- `production`: AKS y Azure Static Web Apps productivo. Configure required
  reviewers para que ningún despliegue continúe sin aprobación.

El job final de GitHub Pages usa además el environment reservado
`github-pages`, exigido por la plataforma. El build ya no lee variables de
`production`. Los workflows de staging por PR conservan sus triggers, URL y
selección de Supabase; no comparten secretos con producción.

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
AZURE_DOCUMENT_LAYOUT_ENABLED
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
AZURE_DOCUMENT_INTELLIGENCE_KEY
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

Variables para la publicación manual a Vaultwarden:

```text
BW_SERVER_URL
BW_ITEM_ID
```

Secrets para esa publicación:

```text
BW_CLIENTID
BW_CLIENTSECRET
BW_PASSWORD
```

Use una cuenta técnica de Vaultwarden limitada a la colección de Acad-IA. No
use la cuenta administrativa de Portainer ni una cuenta personal compartida.

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

La sincronización obtiene el inventario de Key Vault una sola vez y descarga
los valores requeridos en paralelo con concurrencia acotada. Los secretos se
mantienen en archivos con modo `0600`, nunca se incluyen en la salida del job y
un fallo parcial impide continuar el despliegue.

Un commit normal nunca rota credenciales y tampoco revierte un hot-fix de Key
Vault. Para reemplazar secretos externos desde GitHub, ejecute manualmente
`Backend AKS` con `sync_external_secrets=true`.

## Publicación a Vaultwarden

Azure Key Vault permanece como fuente operativa de verdad y Vaultwarden es una
copia consultable para administradores. El workflow manual `Publish backend
secrets to Vaultwarden` usa `bw` 2026.8.0, descarga los valores directamente de
Key Vault y actualiza campos ocultos del item configurado en `BW_ITEM_ID`.
Incluye secretos de Functions, identidad Supabase, Postgres, Dashboard,
Storage y respaldos que estén presentes en el mapa de Key Vault.

El flujo es deliberadamente unidireccional: **Key Vault → Vaultwarden**. Así un
valor editado accidentalmente en el gestor de contraseñas no cambia un runtime
productivo ni crea dos fuentes de verdad. Un hot-fix se hace en Key Vault y
después se publica la nueva instantánea. El script usa archivos temporales con
permisos restrictivos, nunca imprime valores y bloquea/cierra la sesión de `bw`
al terminar. Comparte la descarga paralela y acotada de Key Vault con el
despliegue, pero conserva una sola actualización atómica del item de
Vaultwarden.

La autenticación de CI usa `bw login --apikey` y un desbloqueo explícito. Los
tres valores de autenticación se guardan como secrets del environment
`production`; nunca se escriben en el repositorio. La cuenta debe poder editar
únicamente el item o colección de Acad-IA.

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

La opción `publish_to_vaultwarden` permanece desactivada por defecto. Actívela
en una rotación sólo después de configurar la cuenta técnica; también puede
ejecutar la publicación como workflow independiente escribiendo `PUBLISH`.

`POSTGRES_PASSWORD` y `JWT_SECRET` no se rotan con este workflow: requieren una
ventana de mantenimiento, actualización coordinada de consumidores y un plan
de recuperación probado.

El generador escribe en archivos temporales con permisos restrictivos y las
operaciones de Azure CLI usan `--file`; ningún workflow imprime los valores.

## Imágenes y migraciones

GitHub Actions construye dos imágenes:

- `acad-ia-migrator`: Supabase CLI 2.115.0, cliente Postgres 17, migraciones y
  seed idempotente.
- `acad-ia-backup`: cliente Postgres 17, `rclone` y el procedimiento de
  respaldo.

Cada imagen usa un contexto Docker mínimo y una caché BuildKit de GitHub
independiente. En pull requests se construyen sin publicar para validar los
Dockerfiles; en `main` se construyen y publican una sola vez, sin repetir antes
la misma compilación. Las capas reutilizables permanecen en la caché de Actions
y ACR conserva sólo los artefactos desplegables.

Las pruebas de frontend comienzan en paralelo con la detección de cambios de
Supabase; lint y typecheck también comparten tiempo de ejecución y conservan
resultados independientes. Las pruebas de base, las de Edge Functions y la
creación de una branch hospedada se activan por sus entradas reales, no por
archivos auxiliares de los contenedores self-hosted. GitHub Pages y el frontend
productivo se omiten en commits que no modifican sus entradas de compilación,
y los runs obsoletos de PR, staging y testing se cancelan a favor del commit
más reciente. El staging de Azure activa Supabase y compila el frontend en un
solo job, sin reservar dos runners de forma serial; las operaciones con el
token de Supabase siguen ejecutándose desde la revisión confiable de `main`.

Los jobs de JavaScript usan Bun 1.4.0 y el Dockerfile del frontend fija la misma
versión. Los Actions con runtime propio se mantienen en sus generaciones
actuales basadas en Node 24; cada PR valida todos los workflows con actionlint
y ShellCheck. Un cambio exclusivo al mecanismo de CI se valida en el PR pero
no vuelve a desplegar AKS ni GitHub Pages sin cambios en sus artefactos.
El contexto Docker del frontend usa una lista explícita de archivos de build,
por lo que no transfiere dependencias, worktrees, secretos ni artefactos locales.
Los cambios exclusivos a documentación Markdown bajo `deploy/` tampoco cuentan
como un artefacto de backend desplegable.

Functions usa directamente
`supabase/edge-runtime:v1.74.3@sha256:c52405002a890ca9fcf77978671c57f3a988e03174afb277f84ac65bc917013c`.
No se copia código a un pod o nodo con `scp`: esos sistemas de archivos son
efímeros en AKS. El equivalente reproducible del volumen recomendado por
Supabase es una revisión inmutable en el PVC existente. El repositorio ACR
legado `acad-ia-functions` se eliminó como una operación única después del
primer rollout verificado; el workflow recurrente no elimina repositorios de
contenedores. La revisión Helm previa basada en esa imagen deja de ser un
rollback válido; para volver atrás se redepliega el commit deseado mediante
este mismo workflow.

El Job de Helm ejecuta `supabase migration up --include-all` y después el seed.
Antes de migrar espera hasta diez minutos a que Postgres esté disponible; esto
permite reiniciar el clúster sin consumir los reintentos del Job mientras el
Azure Disk todavía se está adjuntando.
Las migraciones no se revierten automáticamente al revertir workloads; deben
ser compatibles hacia atrás o incluir un rollback probado.

## Storage y respaldos

Postgres usa el PVC `acad-ia-backend-supabase-db-standard-v1`,
`managed-csi`, `ReadWriteOnce`, de 16 GiB. Storage usa
`acad-ia-backend-storage-data-standard-v1`, de 32 GiB con la misma clase. Los
PVC se declaran en `deploy/aks/low-traffic-pvcs.yaml` fuera del ciclo de vida de
Helm: antes de eliminarlos verifique el respaldo, el contenido y el Disk
administrado exactos.

La configuración de pgsodium usa
`acad-ia-backend-supabase-pgsodium-standard-v1` y el código publicado de Edge
Functions usa `acad-ia-backend-supabase-snippets-standard-v1`; ambos son PVC de
1 GiB con `managed-csi`. El único node pool productivo usa un OS efímero. El
workflow falla si detecta discos Premium/Ultra o un node pool con OS
administrado, para evitar regresiones de costo. Además, la asignación Azure
Policy `aks-no-premium-storage`, aplicada solamente al resource group técnico
del clúster, niega discos Premium/Ultra y VMSS sin OS efímero. Su regla está en
`deploy/aks/deny-premium-storage-policy-rule.json`.

La definición y asignación se aprovisionan una vez con:

```bash
az policy definition create \
  --name acad-ia-aks-deny-premium-storage \
  --display-name 'Acad-IA AKS: deny Premium storage and managed OS disks' \
  --description 'Prevents Premium/Ultra managed disks and non-ephemeral AKS node pools.' \
  --mode All \
  --metadata '{"category":"Compute"}' \
  --rules deploy/aks/deny-premium-storage-policy-rule.json

policy_scope="$(az group show \
  --name MC_acad-ia-supabase_group_acad-ia-supabase-aks_mexicocentral \
  --query id \
  --output tsv)"
az policy assignment create \
  --name aks-no-premium-storage \
  --display-name 'Acad-IA AKS: no Premium storage' \
  --description 'Enforced only on the managed resource group for acad-ia-supabase-aks.' \
  --scope "$policy_scope" \
  --policy acad-ia-aks-deny-premium-storage \
  --enforcement-mode Default
```

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
primario de Supabase Storage. Después de subir y verificar un respaldo nuevo,
el mismo Job elimina únicamente archivos con más de 84 días dentro del prefijo
`acad-ia/supabase-production`; no toca otros proyectos ni buckets.

La base ya programa `higiene-documental-diaria`,
`retencion-operativa-diaria`, `purgar-generaciones-ia-90d` y
`limpiar-paquetes-aprendizaje-diaria`. Esos procesos purgan cachés, trabajos y
blobs sin referencias; no eliminan documentos académicos vigentes por edad. El
workflow sincroniza URL, publishable key y secreto interno desde Key Vault a
Supabase Vault y activa los crons de recuperación y limpieza sólo después de
que los tres valores estén presentes.

El dump de Postgres y el archivo del PVC no constituyen una instantánea atómica
entre base y objetos. Para un RPO estricto, complemente este respaldo lógico con
Azure Backup/snapshots coordinados y pruebe restauraciones periódicas en un
namespace aislado.

El workflow histórico `.github/workflows/supabase-update.yaml` exporta
manualmente una instantánea del proyecto administrado de preview; ya no se
ejecuta en cada push. No cubre Postgres ni Storage de AKS.

## Preparación previa del clúster

Antes del primer despliegue deben existir:

1. AKS con OIDC/Workload Identity y ACR asociado.
2. Ingress Web App Routing. El workflow instala cert-manager y reconcilia el
   `ClusterIssuer` de Let's Encrypt antes del chart de la aplicación. También
   mantiene el NGINX administrado en una réplica base y hasta dos réplicas con
   el perfil `steady`. Cuando ya está instalada exactamente la versión fijada
   de cert-manager, omite el `helm upgrade` inalterado y sólo verifica el
   `ClusterIssuer`.
3. Azure Key Vault con RBAC para la identidad federada de GitHub.
4. Azure Monitor/Container Insights y Managed Prometheus según el estándar de
   la plataforma.
5. El bucket S3-compatible `respaldos` en RustFS y una prueba de escritura con las
   credenciales de producción.
6. Required reviewers en el environment `production`.

## Portainer

La consola existente responde con Portainer Business/Essentials 2.39.6 y una
licencia vigente. AKS usa **Edge Agent Standard**: la conexión del agente sale
desde AKS hacia el puerto 8000 de Portainer y no publica un `LoadBalancer` del
agente. El NSG del servidor debe permitir ese puerto sólo desde la IP de salida
del clúster.

Después de crear AKS:

1. En Portainer cree un environment Kubernetes de tipo `Edge Agent Standard`
   con nombre `Acad-IA AKS producción` y URL
   `https://portainer.apps.lci.ulsa.mx`.
2. Guarde los valores generados como secrets `PORTAINER_EDGE_ID` y
   `PORTAINER_EDGE_KEY` del environment `production` en GitHub. No reutilice el
   usuario ni la contraseña de la consola.
3. Ejecute `Connect AKS to Portainer`, modo `standard`, y escriba
   `CONNECT_PORTAINER`.
4. Abra **Live connect**, confirme el dashboard de Kubernetes y limite el acceso
   por equipos/usuarios.

La licencia observada permite tres nodos y actualmente consume uno. Portainer
cuenta cada nodo de Kubernetes, por lo que quedan dos para AKS mientras la
licencia y los demás entornos no cambien. El workflow valida ese límite antes
de instalar el agente. Mantenga el node pool/autoscaler de AKS en un máximo de
dos o amplíe la licencia y ajuste `licensed_aks_nodes`.

El workflow descarga el manifiesto oficial Business 2.39, comprueba su SHA-256
y que la imagen sea exactamente `portainer/agent:2.39.6`, guarda el Edge Key en
un Secret de Kubernetes y espera el rollout. El manifiesto oficial concede
`cluster-admin` a su ServiceAccount: esto es necesario para la administración
completa y debe quedar explícitamente aceptado en la revisión del environment.

Portainer tiene actualizaciones automáticas de parche activas. Antes de aplicar
el manifiesto, el workflow consulta `/api/status` y exige que Server y Agent
coincidan con el pin revisado. Cuando Portainer avance de versión, actualice en
un pull request la versión, URL y SHA-256; el workflow falla cerrado mientras
exista un desfase.

El cliente Helm de Portainer usa el certificado configurado en el servidor como
autoridad para regresar por su propia API. Como Nginx Proxy Manager termina TLS,
Portainer debe conservar una copia del mismo certificado público; de lo contrario
la vista Helm falla con `x509: certificate signed by unknown authority`. Instale
el sincronizador y su temporizador en el VPS:

```bash
sudo install -m 0750 deploy/scripts/sync-portainer-certificate.sh \
  /usr/local/sbin/sync-portainer-certificate
sudo install -m 0644 deploy/portainer/portainer-cert-sync.service \
  /etc/systemd/system/portainer-cert-sync.service
sudo install -m 0644 deploy/portainer/portainer-cert-sync.timer \
  /etc/systemd/system/portainer-cert-sync.timer
sudo systemctl daemon-reload
sudo systemctl enable --now portainer-cert-sync.timer
sudo systemctl start portainer-cert-sync.service
```

El script valida SAN, vigencia y correspondencia de la llave, respalda el par
anterior, reinicia Portainer sólo si cambió y revierte si `/api/status` no vuelve
a responder. Los paths predeterminados corresponden al certificado `npm-2` del
VPS actual; si Nginx Proxy Manager cambia ese identificador, defina
`PORTAINER_SOURCE_CERT` y `PORTAINER_SOURCE_KEY` en
`/etc/default/portainer-cert-sync`.

No mantenga un segundo environment Async para el mismo clúster: duplicaría el
inventario y no ofrecería la conexión interactiva ya disponible en Standard.

El chart desactiva Logflare y Vector. Los contenedores escriben a
`stdout`/`stderr` y AKS recolecta los logs; no se monta el socket de Docker.

Postgres se despliega inicialmente como instancia única. El Azure Disk aporta
persistencia, no alta disponibilidad. Defina RTO/RPO y, si se necesita HA,
migre a un Postgres replicado compatible después de validar extensiones, roles,
webhooks y Realtime.

## Perfil de capacidad y costo

El perfil de producción de baja carga está dimensionado para hasta 500 cuentas
y alrededor de 20 sesiones simultáneas:

- node pool `systemeph` con `Standard_D4ads_v5` (4 vCPU, 16 GiB RAM), OS efímero
  de 64 GiB y autoscaler mínimo 1 y máximo 2;
- perfil del autoscaler con `skip-nodes-with-system-pods=false` y umbral de
  consolidación `0.7`, necesario para consolidar el único node pool aunque los
  discos zonales permanezcan en el nodo que conserva Postgres y Storage;
- una réplica base de Envoy, Edge Runtime y Supavisor;
- NGINX administrado con una réplica base y máximo dos;
- Postgres con reserva de 250m CPU y 1 GiB, conservando límite de 2 CPU/4 GiB;
- Azure Monitor, Managed Prometheus y Portainer permanecen activos.

El segundo nodo es capacidad transitoria para rollouts, reinicios en frío y
picos. El estado estable debe volver a uno cuando los pods quepan y no exista
presión de scheduling. Este perfil prioriza costo sobre alta disponibilidad:
una falla del nodo causa indisponibilidad hasta que AKS reprograme y adjunte los
discos.

El perfil requerido se configura una vez en el clúster existente:

```bash
az aks update \
  --resource-group acad-ia-supabase_group \
  --name acad-ia-supabase-aks \
  --cluster-autoscaler-profile \
    skip-nodes-with-system-pods=false \
    scale-down-utilization-threshold=0.7
```

Los `PodDisruptionBudget` de Envoy y Edge Runtime permiten una interrupción. Con
una réplica esto deja que el autoscaler mueva el pod; con dos réplicas conserva
una disponible durante el drenado.

Un volumen existente de Postgres 15 no se puede conectar directamente a la
imagen 17. La migración desde la instancia actual requiere dump/restore probado
y una ventana de corte.

## Validación local

```bash
node --test deploy/scripts/generate-supabase-secrets.test.mjs
bash -n deploy/scripts/publish-key-vault-to-vaultwarden.sh
bash deploy/scripts/package-functions-source.sh HEAD /tmp/functions.tar.gz
docker compose --env-file .env.example config --quiet
docker buildx bake --file deploy/docker-bake.hcl
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
