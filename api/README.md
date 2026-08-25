# Router fijo de webhooks de OpenAI

La API administrada de Azure Static Web Apps expone el endpoint estable:

```text
https://victorious-bay-0ca0aae10.3.azurestaticapps.net/api/openai-webhook
```

OpenAI entrega aquí los eventos de `proj_wUpPC9kXejgvzyq87BU9tFtc`. La
Function verifica la firma original, recupera la Response, lee
`metadata.supabase_project_ref`, comprueba el destino contra las branches del
proyecto principal y reenvía el cuerpo sin modificar a
`openai-webhook-responses`.

El reenvío usa ECDSA P-256. La clave privada sólo vive en los application
settings de Azure y las Edge Functions contienen únicamente la clave pública.
Las branches no reciben el secreto privado del relay. Sí conservan el mismo
`OPENAI_WEBHOOK_SECRET` del proyecto porque el handler compartido mantiene la
compatibilidad con entregas directas de OpenAI, además de aceptar el relay
firmado. El workflow valida que `OPENAI_API_KEY` pertenezca a
`OPENAI_PROJECT_ID` antes de sincronizar esos secretos con Supabase.

El API se despliega deliberadamente sólo en el entorno `Production` de Azure.
Los previews siguen usando el endpoint fijo anterior; no se debe añadir
`api_location` a su workflow porque Azure copia los application settings a los
entornos de staging y expondría secretos del router a código de PR.

## Application settings

Configurar en el entorno de producción de la Static Web App `Acad-ia`:

```text
OPENAI_API_KEY
OPENAI_PROJECT_ID=proj_wUpPC9kXejgvzyq87BU9tFtc
OPENAI_WEBHOOK_SECRET
SUPABASE_PARENT_PROJECT_REF=exdkssurzmjnnhgtiama
SUPABASE_ACCESS_TOKEN
WEBHOOK_RELAY_PRIVATE_KEY
```

`SUPABASE_ACCESS_TOKEN` sólo requiere lectura de entornos/branches. No se
incluye `local.settings.json` en Git; `local.settings.example.json` documenta
la forma esperada.

## Alta única en OpenAI

En la configuración de webhooks del proyecto, crear un endpoint con la URL
anterior y suscribir:

```text
response.completed
response.cancelled
response.failed
response.incomplete
```

Guardar el signing secret que se muestra una sola vez como
`OPENAI_WEBHOOK_SECRET` en Azure. El endpoint anterior no cambia cuando se
crean o eliminan previews.
