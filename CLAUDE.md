# CLAUDE.md

## Project

Acad-IA is a Spanish-language web app for managing university academic plans (`planes`) and
their subjects (`asignaturas`), including AI-assisted generation of plans, subjects, and
bibliography. Frontend is a React 19 SPA (TanStack Router + Query); the backend is Supabase
(Postgres + Deno edge functions). Domain naming is in Spanish — keep new identifiers consistent.

## Commands

The package manager is **bun**. Note: the README's script table is partly out of date — trust
`package.json`

````

Backend / Supabase:

```bash
bun run test:db          # supabase test db (pgTAP)
bun run test:functions   # deno test --allow-env --allow-read supabase/functions/tests/unit
supabase gen types typescript --local   # regenerate DB types (no npm script for this)
````

See the auto-memory notes for the local Docker Supabase workflow: migrations are applied via
`migration up` against the hosted DB (not `db reset`), SQL is validated by `psql` inside the
`supabase_db_Acad-IA` container, and **edge functions cannot be HTTP-tested locally** (the local
edge runtime is offline — validate their SECURITY DEFINER RPCs directly in psql instead).

## Architecture

### Frontend data layer (`src/data/`)

All server access funnels through this layer; components consume it via hooks, never by calling
Supabase directly. `src/data/index.ts` is the barrel export.

- **`api/*.api.ts`** — thin async functions wrapping the Supabase client or `invokeEdge`. Use the
  `_helpers.ts` utilities (`throwIfError`, `requireData`, `getUserIdOrThrow`, `buildRange`) and
  throw typed `ApiError`. Each module defines an `EDGE` const mapping logical names to edge
  function names.
- **`hooks/use*.ts`** — TanStack Query hooks (`useQuery`/`useMutation`) that call the api layer.
- **`query/keys.ts`** — the `qk` object is the single source of truth for query keys. Always reuse
  these for queries and invalidation; do not inline key arrays.
- **`supabase/client.ts`** — `supabaseBrowser()` returns a lazily-created singleton client.
- **`supabase/invokeEdge.ts`** — `invokeEdge<T>()` is the only way to call edge functions. It
  unwraps `FunctionsHttpError` bodies into a typed `EdgeFunctionError`; read error codes with
  `getEdgeFunctionErrorCode`.

### Auth & permissions (`src/data/auth/`)

- Permissions live in the JWT: a Postgres `custom_access_token_hook` injects `roles_claves` and
  `permisos` into `app_metadata`. `permissions.ts` decodes the JWT client-side
  (`getSessionEffectiveAuthz`) and falls back to DB queries (`resolveEffectiveAuthz`) when claims
  are absent. `ADMIN` role implies all permissions.
- Route protection is done in TanStack Router route loaders via `requireAnyPermission` /
  `requireAnyPermissionOrBootstrap` from `routeGuards.ts`, which redirect to `/` on failure.
- `AppPermission` is the canonical list of permission strings (e.g. `'planes.editar'`, `'ia.usar'`).

### Routing (`src/routes/`)

File-based TanStack Router with `autoCodeSplitting`. **`src/routeTree.gen.ts` is generated — never
edit it by hand** (it's git-tracked and eslint-ignored). The root layout is `__root.tsx`. Route
masks (defined in `main.tsx`) hide the full-screen AI chat URLs behind their parent detail URLs.

### UI

shadcn/ui (new-york style, zinc base) in `src/components/ui/`, built on Radix primitives, styled
with **Tailwind CSS v4** (configured via the `@tailwindcss/vite` plugin — there is no
`tailwind.config`; tokens live in `src/styles.css`). Add components with
`pnpm dlx shadcn@latest add <name>`. `@` is the path alias for `src/`. Feature-specific UI lives
under `src/features/<feature>/` and broader component groups under `src/components/<domain>/`.

### Edge functions (`supabase/functions/`)

Deno runtime, **separate from the frontend toolchain** — they are excluded from `tsconfig.json` and
eslint, and each function has its own `deno.json` import map. `_shared/` holds common code
(`cors.ts`, `openai-service.ts`, `json-schema.ts`, `database.types.ts`, etc.). Per-function
settings (including `verify_jwt`) are declared in `supabase/config.toml`. AI generation functions
(`ai-generate-plan`, `ai-generate-subject`, `generate-subject-suggestions`) call OpenAI; some use a
webhook (`openai-webhook-responses`) for async responses, with results streamed to the client via
Supabase Realtime (`src/data/realtime/watchAIGeneration.ts`, resumed on app load in `__root.tsx`).

### Generated DB types — two copies

- `src/types/supabase.ts` — frontend. After regenerating, run `prettier --write` **and**
  `eslint --fix` (eslint rewrites `T[]` → `Array<T>` to match project style).
- `supabase/functions/_shared/database.types.ts` — Deno side. Run only `prettier --write` (Deno
  style keeps `T[]`).
