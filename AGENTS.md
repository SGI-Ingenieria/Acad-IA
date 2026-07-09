# AGENTS.md

> Canonical instructions for AI coding agents (Claude Code, and any other agent that
> reads `AGENTS.md`). `CLAUDE.md` imports this file, so there is a single source of truth —
> edit rules here, not in `CLAUDE.md`.

## Project

Acad-IA is a Spanish-language web app for managing university academic plans (`planes`) and
their subjects (`asignaturas`), including AI-assisted generation of plans, subjects, and
bibliography. Frontend is a React 19 SPA (TanStack Router + Query); the backend is Supabase
(Postgres + Deno edge functions). Domain naming is in Spanish — keep new identifiers consistent.

## Commands

The package manager is **bun**. Note: the README's script table is partly out of date — trust
`package.json`

Backend / Supabase:

```bash
bun run test:db          # supabase test db (pgTAP)
bun run test:functions   # deno test --allow-env --allow-read supabase/functions/tests/unit
supabase gen types typescript --local   # regenerate DB types (no npm script for this)
```

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

## Design system (UI rules)

These rules are **mandatory** for every new or modified component. The goal is a flat, clean,
token-driven interface. When a rule and an existing file disagree, fix the file.

### 1. Prefer flat layouts — no container-in-container

Do **not** nest bordered/cards/boxes indiscriminately. Each extra `rounded-* border bg-* p-*`
wrapper adds visual noise. A card inside a card inside a bordered `div` looks terrible.

- Prefer plain, flat sections: use spacing (`gap-*`, `space-y-*`) and typography hierarchy to
  separate content, not another box.
- One level of surface is usually enough. Only wrap in a `Card`/bordered container when the group
  genuinely needs elevation or a boundary the eye can't infer from spacing alone.
- When you catch yourself adding a third nesting level of borders/backgrounds, flatten instead.

### 2. Modals: standard size, no footer "Cancel", close with the header X

- **Use the standard `Dialog` size.** `DialogContent` already defaults to `sm:max-w-lg` — do not
  sprinkle ad-hoc widths. Only override the width for a deliberately larger surface (wizard,
  full-content), and reuse a documented size when you do.
- **Do not put a "Cancelar" button in `DialogFooter`.** `DialogContent` renders a header **X**
  (`showCloseButton` defaults to `true`) — that is how a dialog is dismissed. A footer should hold
  only the primary/affirmative action(s). Rely on the **X** for cancel.
- The one exception is a confirmation dialog built on **`AlertDialog`**, where
  `AlertDialogCancel` + `AlertDialogAction` is the intended two-button pattern (see rule 3). That
  is fine and expected there.

### 3. Confirmations & alerts — never native browser dialogs

Never use `window.confirm`, `window.alert`, or `window.prompt` (nor bare `confirm`/`alert`/
`prompt`). They break the theme and can't be styled.

- Use the app dialog helpers from `@/components/ui/app-alert-dialog`:
  `showAppConfirm({ title, description, variant })` (returns `Promise<boolean>`),
  `showAppAlert({...})`, and `showAppPrompt({...})`. The `AppAlertDialogProvider` is already mounted
  at the app root.
- For destructive confirmations pass `variant: 'destructive'`.
- For inline/declarative needs, use the `AlertDialog` primitives in `@/components/ui/alert-dialog`.

### 4. Always honor `src/styles.css`

`src/styles.css` is the single source of design truth. Prioritize it over inline styles or
hard-coded colors.

- Use the theme tokens (`bg-background`, `text-foreground`, `border-border`, `text-primary`, …) and
  the local utilities defined there (`organic-surface`, `organic-glow`, `gradient-border`,
  `organic-interactive`, `organic-chip`, `aurora-mesh`, `tree-child`, …). Don't reinvent them.
- Colors are **oklch**. For inline/SVG colors use `var(--token)` or `oklch(from var(--token) …)` —
  never `hsl(var(--token))`.
- Radii, shadows, spacing, and tracking all come from the tokens (`--radius`, `--shadow-*`,
  `--spacing`, `--tracking-*`). Reuse them rather than hard-coding pixel values.

### 5. Purposeful animation

Use motion to make the UI feel alive but never noisy. Prefer the existing utilities
(`organic-interactive`, `tw-animate-css` `animate-in`/`fade-in`/`zoom-in`, the aurora/pulse
keyframes) over bespoke transitions. Keep it subtle, and always respect
`@media (prefers-reduced-motion: reduce)` (the utilities already do).

### 6. Icon-first, words-second

When a label is redundant, drop the words and let an **icon + Tooltip** carry the meaning. Reserve
full text labels for genuinely important headers/titles. Example: a status that reads
"Estado: Operando" should collapse to a single status icon with a Tooltip that says "Operando" —
cleaner and calmer. Prefer compact icon buttons (with an accessible `aria-label`) for secondary
actions.

### 7. Tooltips: always shadcn, never the native `title`

**Never** use the native HTML `title` attribute on DOM elements to show hover text (it's unstyled,
slow to appear, and inaccessible on touch). Always use the shadcn `Tooltip`:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

<Tooltip>
  <TooltipTrigger asChild>
    <Button size="icon" variant="ghost" aria-label="Limpiar">
      <Trash2 className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Limpiar eventos recientes</TooltipContent>
</Tooltip>
```

`Tooltip` already wraps its own `TooltipProvider`, so no extra provider is needed. Keep an
`aria-label` on icon-only triggers for screen readers. (`title=` passed to an uppercase React
**component**, e.g. `<Card title=...>`, is a normal prop — that's fine; the rule is only about the
native DOM attribute.)
