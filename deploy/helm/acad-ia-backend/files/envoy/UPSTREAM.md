# Envoy upstream

Source: `supabase/supabase`, commit
`717927f4f296421b8529fed3f7eeb1212006bf8f`, directory
`docker/volumes/api/envoy/`.

Local adaptations:

- `cds.yaml` replaces Docker service names with the stable Kubernetes Services
  `supabase-auth`, `supabase-rest`, `supabase-realtime`, `supabase-storage`,
  `supabase-functions`, `supabase-meta` and `supabase-studio`.
- `docker-entrypoint.sh` copies `envoy.yaml` and `cds.yaml` from the read-only
  ConfigMap mount `/etc/envoy-src` into the writable `emptyDir` `/etc/envoy`, and
  renders `lds.yaml` there.

Route policy, Lua filters, RBAC, timeouts and listener hardening remain upstream.
