# AGENTS.md

> Canonical instructions for AI coding agents, including Claude Code and any other agent that
> reads `AGENTS.md`.
>
> `CLAUDE.md` imports this file, so this is the single source of truth. Edit rules here, not in
> `CLAUDE.md`.

## Project

Acad-IA is a Spanish-language web application for managing university academic plans (`planes`)
and their subjects (`asignaturas`), including AI-assisted generation of plans, subjects, and
bibliography.

The frontend is a React 19 SPA using TanStack Router and TanStack Query. The backend is Supabase,
using Postgres and Deno edge functions.

Domain terminology and identifiers are written in Spanish. Keep new domain names, variables,
functions, routes, database objects, and user-facing concepts consistent with the existing Spanish
naming.

Acad-IA must not be treated as a generic CRUD application. It is an academic planning, analysis,
and curriculum-research system. New functionality should reinforce that product identity through
strong information architecture, traceability, resilient interaction, and deliberate visual
design.

## Package manager and commands

The package manager and script runner is **Bun**.

The README script table is partly out of date. Trust `package.json`.

Use:

```bash
bun run <script>
```

for repository scripts.

Prefer:

```bash
bunx <package>
```

for one-off package executables when compatible.

Some upstream documentation may show `npx`, `pnpm dlx`, or another package-manager command.
Translate it to the project's Bun convention unless the documented tool specifically requires
otherwise.

Never add a second lockfile.

### Backend and Supabase

```bash
bun run test:db
bun run test:functions
supabase gen types typescript --local
```

Command purposes:

```bash
bun run test:db
```

Runs the Supabase database pgTAP tests.

```bash
bun run test:functions
```

Runs:

```bash
deno test --allow-env --allow-read supabase/functions/tests/unit
```

```bash
supabase gen types typescript --local
```

Regenerates the database TypeScript types. There is no npm script for this command.

See the auto-memory notes for the local Docker Supabase workflow.

Important constraints:

- Migrations are applied through `migration up` against the hosted database, not through
  `db reset`.
- SQL is validated with `psql` inside the `supabase_db_Acad-IA` container.
- Edge functions cannot be HTTP-tested locally because the local edge runtime is offline.
- Validate SECURITY DEFINER RPCs directly in `psql` when local HTTP testing is unavailable.
- Never claim that a migration, RPC, function, test, or deployment was validated unless the
  corresponding command was actually run.

## Architecture

### Frontend data layer: `src/data/`

All server access must pass through the frontend data layer.

React components and feature components must never call Supabase directly.

`src/data/index.ts` is the barrel export.

#### `api/*.api.ts`

These files contain thin asynchronous functions that wrap the Supabase client or `invokeEdge`.

Use utilities from `_helpers.ts`, including:

- `throwIfError`
- `requireData`
- `getUserIdOrThrow`
- `buildRange`

Throw typed `ApiError` instances.

Each API module defines an `EDGE` constant that maps logical operation names to edge-function
names.

Do not:

- call `supabaseBrowser()` directly from components;
- place React state or UI notifications inside API modules;
- discard structured backend errors;
- return loosely typed `any` payloads;
- duplicate error-unwrapping logic already provided by the data layer.

#### `hooks/use*.ts`

These files contain TanStack Query hooks built with `useQuery`, `useMutation`, or other documented
TanStack Query primitives.

Hooks call the API layer. They do not bypass it.

Mutation hooks are responsible for the appropriate combination of:

- optimistic updates;
- mutation state;
- rollback;
- cache reconciliation;
- invalidation;
- known error-code interpretation.

#### `query/keys.ts`

The `qk` object is the single source of truth for query keys.

Always reuse `qk` for:

- queries;
- prefetching;
- cache access;
- optimistic updates;
- invalidation;
- removal;
- cancellation.

Never inline query-key arrays.

Incorrect:

```ts
queryKey: ['planes', planId]
```

Correct:

```ts
queryKey: qk.planes.detail(planId)
```

When introducing a new query, first determine whether an existing key family already represents
the same domain entity or view.

#### `supabase/client.ts`

`supabaseBrowser()` returns a lazily created singleton browser client.

Do not create additional Supabase browser clients.

#### `supabase/invokeEdge.ts`

`invokeEdge<T>()` is the only supported way to call edge functions from the frontend.

It unwraps `FunctionsHttpError` response bodies into typed `EdgeFunctionError` objects.

Read edge-function error codes with:

```ts
getEdgeFunctionErrorCode
```

Do not invoke Supabase functions directly from React components or recreate invocation/error logic
elsewhere.

### Authentication and permissions: `src/data/auth/`

Permissions are stored in the JWT.

A Postgres `custom_access_token_hook` injects:

- `roles_claves`
- `permisos`

into `app_metadata`.

`permissions.ts` decodes the JWT client-side using:

```ts
getSessionEffectiveAuthz
```

It falls back to database queries using:

```ts
resolveEffectiveAuthz
```

when the claims are absent.

The `ADMIN` role implies every permission.

Route protection is implemented in TanStack Router loaders using:

- `requireAnyPermission`
- `requireAnyPermissionOrBootstrap`

from `routeGuards.ts`.

Failed route authorization redirects to `/`.

`AppPermission` is the canonical list of permission strings, such as:

```ts
'planes.editar'
'ia.usar'
```

Do not:

- duplicate permission strings outside the canonical type;
- use UI hiding as the only permission boundary;
- assume that a disabled button replaces backend authorization;
- trust stale client state for consequential authorization decisions.

### Routing: `src/routes/`

Routing uses file-based TanStack Router with `autoCodeSplitting`.

`src/routeTree.gen.ts` is generated, tracked by Git, and ignored by ESLint.

Never edit `src/routeTree.gen.ts` manually.

The root layout is:

```text
src/routes/__root.tsx
```

Route masks are defined in `main.tsx`.

They hide full-screen AI chat URLs behind their parent detail URLs.

Treat the URL and route tree as part of the application's state and public interaction contract.

Use:

- typed `Link`;
- typed `navigate`;
- validated search parameters;
- loaders;
- `beforeLoad`;
- route context;
- pending components;
- error components;
- not-found handling;
- documented Router and Query integration.

Do not:

- construct internal URLs with string concatenation;
- mirror URL state unnecessarily into `useState`;
- place secrets or private document content in search parameters;
- create custom navigation state when Router search parameters or route context are appropriate;
- edit generated route files.

Before implementing routing behavior, inspect the installed TanStack Router version and consult the
official documentation for that version.

### UI

The UI uses shadcn/ui with:

- new-york style;
- zinc base;
- Radix primitives.

Styling uses Tailwind CSS v4 through the `@tailwindcss/vite` plugin.

There is no `tailwind.config`.

Design tokens and local utilities live in:

```text
src/styles.css
```

The `@` alias resolves to:

```text
src/
```

Feature-specific UI belongs under:

```text
src/features/<feature>/
```

Broader domain component groups belong under:

```text
src/components/<domain>/
```

Reusable primitives belong under:

```text
src/components/ui/
```

Before adding a shadcn component, check whether it already exists.

Use:

```bash
bunx shadcn@latest add <name>
```

Inspect the generated diff before keeping it.

Do not overwrite intentional local customizations blindly.

When available, use the official shadcn CLI documentation command to inspect a component before
implementing or modifying it:

```bash
bunx shadcn@latest docs <component>
```

If the installed CLI version does not provide that command, consult the official shadcn
documentation directly.

### Edge functions: `supabase/functions/`

Edge functions run in the Deno runtime.

They are separate from the frontend toolchain.

They are excluded from:

- `tsconfig.json`;
- frontend ESLint.

Each function has its own `deno.json` import map.

Shared edge-function code belongs in:

```text
supabase/functions/_shared/
```

Shared modules include:

- `cors.ts`
- `openai-service.ts`
- `json-schema.ts`
- `database.types.ts`

Per-function settings, including `verify_jwt`, are declared in:

```text
supabase/config.toml
```

AI generation functions include:

- `ai-generate-plan`
- `ai-generate-subject`
- `generate-subject-suggestions`

Some AI operations use:

```text
openai-webhook-responses
```

for asynchronous responses.

Results are streamed to the frontend through Supabase Realtime using:

```text
src/data/realtime/watchAIGeneration.ts
```

Generation watchers are resumed on application load in:

```text
src/routes/__root.tsx
```

Do not implement a second, competing AI-generation lifecycle without first understanding and
extending this existing architecture.

### Generated database types

There are two generated copies.

#### Frontend copy

```text
src/types/supabase.ts
```

After regeneration, run:

```bash
prettier --write src/types/supabase.ts
eslint --fix src/types/supabase.ts
```

ESLint rewrites:

```ts
T[]
```

to:

```ts
Array<T>
```

to match the frontend project style.

#### Deno copy

```text
supabase/functions/_shared/database.types.ts
```

Run only:

```bash
prettier --write supabase/functions/_shared/database.types.ts
```

Deno style keeps:

```ts
T[]
```

Do not apply frontend ESLint style transformations to the Deno copy.

## General implementation principles

### 1. Documentation-first implementation

Do not implement framework or provider behavior from memory when the current official
documentation, installed types, package source, or project-local examples can be consulted.

Before introducing or materially changing behavior involving:

- TanStack Router;
- TanStack Query;
- React;
- Supabase;
- OpenAI;
- shadcn/ui;
- Radix;
- Tailwind;
- Deno;
- another fast-moving dependency;

perform the following process:

1. Inspect the installed package version in `package.json`, `bun.lock`, a Deno import map, or the
   relevant configuration.
2. Search the repository for the same pattern or adjacent functionality.
3. Consult the official documentation corresponding to the installed version.
4. Inspect TypeScript types or package source when the documentation is ambiguous.
5. Prefer documented first-party capabilities over custom implementations.
6. Confirm that the chosen API is current and appropriate before writing code.
7. Implement the smallest abstraction that satisfies the requirement.
8. Verify the behavior with relevant tests or direct inspection.

Documentation research is part of implementation, not an optional preliminary step.

Do not rely primarily on:

- memory;
- generic React patterns;
- blog posts;
- Stack Overflow;
- copied snippets;
- outdated examples;
- framework behavior from a different major version.

Third-party sources may supplement, but not replace, official documentation and project evidence.

When a decision is version-specific or non-obvious, record it in the most appropriate durable
place:

- a concise code comment;
- a test name;
- a migration comment;
- an ADR or project note;
- the implementation summary.

Do not add comments that merely restate the code.

### 2. Search the repository before creating anything

Before adding a component, hook, helper, type, API function, query key, schema, dialog, utility, or
state abstraction, search the repository.

Look for:

- an existing implementation;
- a partial implementation;
- a neighboring domain pattern;
- a component that can be extended;
- a helper that already encodes project conventions;
- a query key family that already represents the entity;
- a server primitive that already provides the capability.

Do not create near-duplicate abstractions.

Prefer extending an established project pattern over introducing a competing style.

### 3. Use connected project tooling before guessing

When a Supabase MCP server or another project-aware tool is available, use it to inspect the actual
project before making consequential backend assumptions.

Use connected Supabase tooling, as appropriate, to inspect:

- tables;
- columns;
- data types;
- constraints;
- foreign keys;
- indexes;
- row-level security policies;
- database functions;
- RPCs;
- triggers;
- migrations;
- extensions;
- project configuration;
- current schema state.

Generated TypeScript types are useful evidence but are not proof that the deployed database and
repository are synchronized.

For consequential schema assumptions, verify against the actual project when the tooling is
available.

Treat connected tooling as privileged access.

Rules:

- Prefer read-only inspection during investigation.
- Use the narrowest operation that can answer the question.
- Never expose secrets, tokens, service-role keys, connection strings, or unrelated user data.
- Never execute destructive SQL without an explicit task requirement.
- Never deploy functions, apply migrations, modify policies, or change project configuration merely
  while investigating.
- Inspect migration history and current schema before proposing schema changes.
- Do not assume that an MCP tool is connected or functional; verify availability.
- If the tool is unavailable, use repository evidence and state the limitation.

### 4. Capability-first React and TanStack design

Before adding:

- `useState`;
- `useEffect`;
- `useReducer`;
- context;
- a custom store;
- synchronization code;
- custom caching;
- manual loading flags;
- manual retry logic;
- custom navigation state;
- polling;
- a custom event bus;

determine whether the concern belongs to an existing platform primitive.

Use this order of preference:

1. URL and navigation state: TanStack Router.
2. Server state, caching, mutations, retries, invalidation, and optimistic updates: TanStack Query.
3. Form state and validation: the project's established form solution.
4. Authoritative cross-client or long-running progress: Supabase Realtime and database records.
5. Existing project contexts or stores.
6. Local React state only for ephemeral, component-local presentation state.

State that generally should not begin as `useState` includes:

- filters that should survive navigation;
- selected tabs that should be shareable or restorable;
- pagination;
- sorting;
- route-relevant selections;
- fetched records;
- loading states for server data;
- mutation progress;
- values fully derived from props, queries, or search parameters;
- durable AI-generation progress;
- duplicated copies of server entities.

Use Router search parameters for state that should:

- survive reload;
- support browser back and forward;
- be shareable;
- be bookmarkable;
- affect route-level data.

Use TanStack Query for:

- server state;
- query caching;
- request deduplication;
- stale-data management;
- retries;
- invalidation;
- optimistic mutations;
- background refetching;
- mutation status.

Use local state for concerns such as:

- whether a local popover is open;
- temporary hover or presentation state;
- an unsaved, component-local interaction that does not belong to a form abstraction;
- ephemeral animation state.

Do not use `useEffect` as a default mechanism for:

- deriving state;
- responding to a button click;
- loading route data;
- mirroring one state variable into another;
- copying query data into local state;
- synchronizing two application-owned sources of truth.

Effects are for synchronization with external systems that cannot be represented declaratively.

Before creating a custom hook, reducer, debounce, cache, poller, state machine, or event bus, search:

- the repository;
- TanStack Router;
- TanStack Query;
- React's current documented capabilities;
- Supabase;
- the browser platform;
- existing shadcn and Radix primitives.

Only create a custom abstraction when the existing primitives cannot satisfy the requirement
cleanly.

Document the missing capability or trade-off that justifies the abstraction.

### 5. Prefer current official capabilities

Do not choose the oldest or most familiar API merely because it is easier to remember.

Before integrating an external service or framework capability:

- inspect the current official documentation;
- review available primitives;
- determine whether the existing project already uses a current approach;
- compare the reliability and maintenance implications;
- choose the most appropriate supported API.

Do not hard-code assumptions about:

- API deprecation;
- model names;
- context limits;
- framework capabilities;
- tool support;
- rate limits;
- undocumented behavior.

Verify them.

### 6. Resilience over minimum implementation effort

Prefer a robust implementation over the shortest implementation.

It is acceptable for a solution to require more code, more validation, more model usage, or more
careful state management when that materially improves:

- correctness;
- recoverability;
- user feedback;
- consistency;
- observability;
- idempotency;
- failure handling;
- maintainability.

Do not overengineer speculative requirements. Add resilience where concrete failure modes exist or
are reasonably expected.

## Design system

These rules are mandatory for every new or modified component.

When a rule conflicts with an existing file, fix the file rather than reproducing the violation.

### 1. Prefer flat layouts

Do not nest bordered surfaces, cards, boxes, and backgrounds indiscriminately.

Each unnecessary wrapper such as:

```text
rounded-* border bg-* p-*
```

adds visual noise.

A card inside a card inside another bordered container is usually incorrect.

Prefer:

- spacing;
- typography;
- alignment;
- separators used sparingly;
- grouping through layout;
- progressive disclosure.

One visual surface level is usually enough.

Only introduce a card or bordered container when the group genuinely requires:

- elevation;
- a distinct interaction boundary;
- a clearly isolated semantic unit;
- a boundary the eye cannot infer from spacing alone.

When adding a third level of border or background nesting, stop and flatten the composition.

### 2. Use standard dialog sizing

`DialogContent` defaults to:

```text
sm:max-w-lg
```

Use the standard size unless the surface deliberately requires additional width.

Acceptable reasons include:

- a wizard;
- a dense full-content editor;
- a reusable documented large-dialog pattern;
- content that is unusable at the default size.

Do not add arbitrary width overrides to individual dialogs.

### 3. Dialogs do not have footer cancellation buttons

Do not place a `"Cancelar"` button in `DialogFooter`.

`DialogContent` renders a header close button by default through:

```ts
showCloseButton
```

The header X is the standard dismissal mechanism.

A dialog footer should normally contain only:

- the primary action;
- other affirmative actions when genuinely necessary.

The exception is an `AlertDialog`.

An `AlertDialog` should use the intended two-button confirmation pattern:

- `AlertDialogCancel`
- `AlertDialogAction`

### 4. Never use native browser dialogs

Never use:

```ts
window.confirm
window.alert
window.prompt
confirm
alert
prompt
```

They break the theme, cannot be styled properly, and produce inconsistent accessibility and UX.

Use the application helpers from:

```text
@/components/ui/app-alert-dialog
```

Available helpers:

```ts
showAppConfirm
showAppAlert
showAppPrompt
```

Example:

```ts
const confirmed = await showAppConfirm({
  title: 'Eliminar asignatura',
  description:
    'La asignatura se eliminará del plan. Esta acción no puede deshacerse.',
  variant: 'destructive',
})
```

For destructive confirmations, use:

```ts
variant: 'destructive'
```

For declarative inline confirmation flows, use the primitives from:

```text
@/components/ui/alert-dialog
```

### 5. Always honor `src/styles.css`

`src/styles.css` is the single source of design truth.

Prioritize it over:

- inline styles;
- arbitrary colors;
- hard-coded shadows;
- hard-coded radii;
- ad hoc spacing;
- duplicated animation;
- local token systems.

Use theme tokens such as:

```text
bg-background
text-foreground
border-border
text-primary
bg-muted
text-muted-foreground
```

Use local utilities such as:

```text
organic-surface
organic-glow
gradient-border
organic-interactive
organic-chip
aurora-mesh
tree-child
```

Do not recreate an existing local utility with a separate Tailwind composition.

Colors use OKLCH.

For inline or SVG color expressions, use:

```css
var(--token)
```

or:

```css
oklch(from var(--token) ...)
```

Never use:

```css
hsl(var(--token))
```

Radii, shadows, spacing, and tracking come from design tokens, including:

```text
--radius
--shadow-*
--spacing
--tracking-*
```

Reuse them instead of hard-coding pixel values.

### 6. Use purposeful animation

Motion should communicate:

- causality;
- state changes;
- hierarchy;
- continuity;
- progress.

It should not create ambient noise.

Prefer existing utilities:

```text
organic-interactive
animate-in
fade-in
zoom-in
```

and the existing aurora and pulse keyframes.

Avoid bespoke transitions unless the existing utilities cannot express the required behavior.

Keep animation subtle.

Always respect:

```css
@media (prefers-reduced-motion: reduce);
```

Existing utilities already account for reduced motion. Custom animation must do the same.

### 7. Icon-first, words-second

When a text label is redundant, prefer an icon with a Tooltip.

Example:

Instead of:

```text
Estado: Operando
```

use an appropriate status icon with a Tooltip containing:

```text
Operando
```

Prefer compact icon buttons for secondary actions.

Every icon-only interactive control must have:

- an accessible `aria-label`;
- a shadcn Tooltip where explanatory hover or focus text is useful;
- a sufficient touch target;
- an unambiguous icon.

Use full text labels for:

- primary actions;
- important headers;
- actions whose icons are not broadly understood;
- actions that would otherwise become ambiguous;
- critical or destructive operations.

Do not remove text merely to make the interface smaller.

### 8. Tooltips must use shadcn

Never use the native HTML `title` attribute on DOM elements to provide hover text.

Native tooltips are:

- unstyled;
- slow;
- inconsistent;
- poor on touch devices;
- not aligned with the design system.

Use:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
;<Tooltip>
  <TooltipTrigger asChild>
    <Button size="icon" variant="ghost" aria-label="Limpiar">
      <Trash2 className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Limpiar eventos recientes</TooltipContent>
</Tooltip>
```

`Tooltip` already wraps its own `TooltipProvider`.

Do not add another provider unless the project implementation changes.

Keep an `aria-label` on icon-only triggers.

This rule applies only to the native DOM `title` attribute.

A prop such as:

```tsx
<Card title="Resumen" />
```

is valid when `Card` is a React component that explicitly defines a `title` prop.

### 9. Prefer shadcn and project primitives over raw controls

Before creating an interactive component, search:

1. `src/components/ui/`;
2. `src/components/<domain>/`;
3. `src/features/<feature>/`;
4. the official shadcn component registry;
5. available Radix primitives already used by the project.

Prefer project or shadcn primitives for:

- buttons;
- icon buttons;
- inputs;
- textareas;
- selects;
- comboboxes;
- checkboxes;
- radio groups;
- switches;
- sliders;
- calendars;
- dialogs;
- alert dialogs;
- sheets;
- popovers;
- dropdown menus;
- context menus;
- command palettes;
- tabs;
- accordions;
- tooltips;
- toasts;
- tables;
- pagination;
- skeletons;
- progress indicators;
- badges.

Do not hand-roll an interactive widget that shadcn or Radix already provides unless the available
primitive cannot satisfy the requirement.

An exception must preserve:

- keyboard operation;
- focus management;
- ARIA semantics;
- touch accessibility;
- reduced-motion behavior;
- design tokens;
- visual consistency.

### 10. Preserve semantic HTML

Do not replace correct semantic document elements merely to maximize shadcn usage.

Native semantic elements remain appropriate for:

- `main`;
- `nav`;
- `section`;
- `article`;
- `header`;
- `footer`;
- headings;
- paragraphs;
- lists;
- labels;
- figures;
- tables where an actual data table is intended.

Use shadcn primarily for interactive controls and reusable interface primitives.

Do not make a `div` behave like a button or link.

Use:

- a button for an action;
- a link for navigation;
- semantic headings for document structure.

### 11. Reuse typography primitives

shadcn/ui does not provide a universal canonical `Title` component that should automatically
replace semantic headings.

Do not invent different heading styles in every feature.

Before styling a heading directly, search for existing local primitives such as:

- `PageHeader`;
- `PageTitle`;
- `SectionHeading`;
- `SectionDescription`;
- `EmptyState`;
- `FormField`;
- `DataToolbar`.

If a repeated typographic pattern exists but no primitive represents it, create a small,
token-driven local primitive when repetition justifies it.

Typography primitives must:

- preserve semantic HTML;
- support an appropriate element or `asChild` pattern where useful;
- use design tokens;
- avoid embedding feature-specific behavior;
- avoid becoming wrappers around one trivial class string with no reusable meaning.

A page must have a clear heading hierarchy.

Do not select heading levels based on visual size. Select them based on document structure and style
them accordingly.

### 12. Research-grade product design

Acad-IA must not look or behave like:

- a generic admin dashboard;
- a spreadsheet clone;
- an autogenerated CRUD interface;
- an arbitrary stack of cards;
- a collection of disconnected forms.

Treat it as a serious academic-analysis and curriculum-research system.

Every substantial feature should communicate relevant aspects of:

- information hierarchy;
- provenance;
- academic relationships;
- system status;
- confidence;
- uncertainty;
- validation;
- revision history;
- authorship;
- AI involvement;
- unresolved decisions;
- next actions.

Prefer interfaces that expose the structure of the academic domain, including:

- plan architecture;
- academic progression;
- prerequisite relationships;
- dependency relationships;
- subject composition;
- credit distribution;
- workload distribution;
- learning outcomes;
- bibliography provenance;
- generation status;
- revision history;
- validation findings;
- inconsistencies;
- conflicts;
- unresolved decisions.

“Research-grade” does not mean adding decorative complexity.

It means:

- denser meaning;
- better traceability;
- clearer hierarchy;
- stronger feedback;
- more capable interaction;
- better evidence;
- better explanation of system state.

Do not add cards, gradients, badges, charts, borders, or animations merely to make the product look
advanced.

### 13. Design the page around a question

Before implementing a substantial page or feature, identify:

1. The primary question the page answers.
2. The principal entity.
3. The supporting evidence.
4. The dominant action.
5. The secondary actions.
6. The information that must be visible immediately.
7. The information that can be progressively disclosed.
8. The important relationships.
9. The relevant uncertainty or validation state.
10. The loading, empty, partial, permission-denied, stale, and failure states.

Choose an information structure appropriate to the domain.

Consider whether the content is better represented through:

- hierarchy;
- comparison;
- timeline;
- matrix;
- dependency graph;
- structured detail;
- progressive workflow;
- annotated evidence;
- side-by-side revision;
- status model.

Do not default every entity to a form followed by a table.

### 14. Use progressive disclosure

Keep common workflows calm without removing expert capability.

Show the minimum information needed for:

- orientation;
- the next decision;
- the primary action.

Place advanced configuration in appropriate secondary surfaces such as:

- accordions;
- popovers;
- sheets;
- tabs;
- expandable sections;
- dedicated secondary routes.

Do not hide behind hover-only interactions:

- critical warnings;
- destructive consequences;
- provenance;
- uncertainty;
- permission implications;
- validation failures.

Preserve context when opening details.

Avoid unnecessary route transitions for small edits.

Use compact controls for secondary actions, but do not sacrifice discoverability for actions
required to complete the workflow.

### 15. Design meaningful empty states

Do not use generic empty-state text such as:

```text
No hay datos
```

when the application can explain:

- what is absent;
- why it matters;
- what the user can do next;
- whether the absence is expected;
- whether permissions or filters caused it.

A useful empty state normally contains:

- a clear explanation;
- relevant context;
- a meaningful next action;
- optional guidance when the workflow is unfamiliar.

Do not add a decorative illustration unless it contributes to understanding.

### 16. Preserve layout during loading

Avoid blank pages and unnecessary full-screen spinners.

Prefer:

- cached data;
- route pending UI;
- local skeletons;
- stable placeholders;
- subtle progress indicators;
- preservation of existing content during background refresh.

Loading states should minimize layout shift.

A background refetch should not replace usable cached content with a blocking spinner.

## Data, state, and interaction

### 1. Instant-feeling user feedback

Every user action must produce immediate perceptible feedback.

Appropriate feedback may include:

- an optimistic state change;
- a local pending indicator;
- a disabled affected action;
- a toast;
- inline progress;
- a skeleton;
- navigation feedback;
- a durable generation status.

Never make the user initiate an action and receive no visible acknowledgement while the request is
in progress.

Do not freeze the entire page for an operation that affects only one item or one action.

### 2. Prefer optimistic updates

For user-initiated mutations, prefer reflecting the intended result immediately while the server
request completes when the operation has a safe and comprehensible rollback strategy.

Use TanStack Query's documented optimistic-mutation workflow.

The implementation should account for:

1. Cancelling or accounting for conflicting in-flight queries.
2. Snapshotting the previous canonical cache state.
3. Updating every affected `qk` cache entry consistently.
4. Showing a visible pending state.
5. Rolling back from the snapshot on failure.
6. Showing a clear Spanish error message.
7. Reconciling or invalidating authoritative queries after settlement.
8. Preventing stale responses from overwriting newer intent.
9. Handling concurrent mutations.
10. Preserving navigation independence where needed.

Optimistic updates are usually appropriate for:

- reordering;
- toggling;
- renaming;
- editing ordinary fields;
- assigning relationships;
- removing relationships;
- archiving;
- reversible deletion when a complete snapshot exists;
- local metadata changes with deterministic results.

### 3. Do not use blind optimism

Do not apply optimistic updates when rollback would be unsafe, misleading, or impossible.

Examples include:

- permission-sensitive operations with genuinely uncertain outcomes;
- irreversible external side effects;
- security-critical changes;
- legally consequential actions;
- operations that require unknown server-generated values;
- AI-generated output that does not yet exist;
- operations with conflicts that cannot be reconciled reliably;
- actions where the server may substantially transform the requested result.

In these cases, still provide immediate feedback.

For example:

- show a pending state on the affected action;
- preserve the rest of the page;
- keep existing data visible;
- allow unrelated navigation;
- display progress where available;
- report failure clearly.

### 4. Cache correctness is mandatory

Optimistic speed is valuable only when the cache remains correct.

For every mutation, identify all affected query representations, including:

- detail views;
- lists;
- paginated lists;
- counts;
- summaries;
- parent entities;
- relationship views;
- search results;
- dashboards;
- validation results;
- derived academic structures.

Update or invalidate every relevant `qk` family.

Do not invalidate the entire application when a narrower invalidation is sufficient.

Do not create a second copy of server truth in component state.

Use stable identifiers, not array positions.

When optimistic entities use temporary identifiers, define how they will be reconciled with
server-generated identifiers.

Account for:

- concurrent mutations;
- out-of-order completion;
- stale refetches;
- duplicate submissions;
- navigation during mutation;
- rollback after subsequent local changes.

Before implementing a mutation that affects several academic views, explicitly identify the query
families that must remain consistent.

### 5. Route-independent mutation state

Navigation must not cancel, hide, or corrupt important mutation outcomes.

If an operation may outlive its originating component, keep its authoritative state in:

- TanStack Query;
- the database;
- the existing AI-generation infrastructure;
- another route-independent owner.

Do not keep durable work exclusively in component-local state.

### 6. Selective retries

Retries must be intentional.

Retry when safe and appropriate for:

- transient network failures;
- temporary service unavailability;
- documented rate limits;
- temporary gateway failures;
- recoverable provider failures.

Do not automatically retry:

- validation failures;
- authentication failures that require user action;
- permission denials;
- malformed input;
- schema failures;
- known permanent failures;
- non-idempotent operations without duplicate protection.

Use exponential backoff and jitter where appropriate.

Do not create infinite retry loops.

Make retry status visible when the delay is user-relevant.

### 7. Idempotency and duplicate protection

Buttons and forms must resist accidental duplicate submission.

Use the appropriate combination of:

- mutation state;
- idempotency keys;
- request identifiers;
- database uniqueness constraints;
- server-side deduplication;
- transaction boundaries;
- webhook event identifiers.

Disabling a button alone is not a complete consistency strategy.

Any operation that may be retried must be safe to repeat or protected against duplication.

### 8. Explicit failure semantics

Remote operations must distinguish meaningful failure categories.

Consider:

- validation failure;
- authentication expiration;
- permission denial;
- resource not found;
- conflict;
- duplicate request;
- rate limiting;
- network interruption;
- timeout;
- provider outage;
- malformed provider response;
- internal server error;
- cancellation;
- stale or superseded operation.

Keep errors typed through the existing:

- `ApiError`;
- `EdgeFunctionError`.

Do not convert every failure into a generic string.

Map known codes to specific Spanish user-facing messages.

Preserve original diagnostic causes without exposing sensitive internal details in the UI.

Do not silently swallow errors.

A caught error must be:

- handled and surfaced;
- transformed into a typed domain error;
- rolled back and reconciled;
- or intentionally ignored with a documented reason.

### 9. Cancellation and stale responses

Where supported, remote operations should account for:

- route changes;
- component unmounting;
- newer user intent;
- superseded requests;
- stale results.

A slow older response must not overwrite a newer user decision.

Use documented cancellation and request-scoping mechanisms.

Do not rely solely on an `isMounted` flag.

### 10. Offline and interrupted connectivity

For workflows that may reasonably encounter connectivity loss:

- preserve the user's visible state where safe;
- indicate that synchronization is pending or failed;
- provide a retry path;
- avoid pretending that an unconfirmed mutation succeeded permanently;
- reconcile when connectivity returns if the architecture supports it.

Do not invent a complete offline architecture for every feature. Address it proportionally to the
workflow.

## OpenAI and AI integrations

### 1. Consult current official OpenAI documentation

Before implementing or materially modifying an OpenAI integration:

1. Inspect the installed OpenAI SDK version.
2. Read the current official documentation.
3. Review existing project AI services and edge functions.
4. Determine whether the required capability already exists.
5. Select the appropriate current API and model.
6. Verify model-specific limitations.
7. Design structured failure and recovery behavior.

Do not implement OpenAI behavior from memory.

Do not use third-party summaries as the primary source for API behavior.

### 2. Prefer the Responses API for new integrations

Use the Responses API for new OpenAI integrations unless:

- an existing project integration must remain compatible;
- a required capability is only available through another supported API;
- migration would create unjustified risk;
- official documentation recommends another API for the specific workflow.

Do not default to Chat Completions merely because it is familiar.

Do not describe Chat Completions as deprecated unless the current official documentation explicitly
states that for the relevant API or feature.

### 3. Evaluate available AI capabilities

Before reducing an AI feature to a single text-generation request, inspect whether the current API
supports relevant capabilities such as:

- structured outputs;
- JSON Schema;
- function calling;
- tool calling;
- streaming;
- response chaining;
- conversation state;
- background execution;
- webhooks;
- file inputs;
- retrieval;
- remote tools;
- built-in tools;
- prompt caching;
- reasoning controls;
- usage metadata;
- cost metadata;
- cancellation;
- safety controls.

Use advanced capabilities only when they materially improve the workflow.

Do not add tools or multi-step orchestration merely to make the implementation appear sophisticated.

### 4. Prefer machine-validated output

When the application requires structured data, prefer:

- strict JSON Schema;
- typed structured outputs;
- explicit validation;
- domain-level normalization.

Do not parse arbitrary prose when a structured response can provide a reliable contract.

Validate AI output at the backend trust boundary.

Distinguish:

- transport failure;
- provider error;
- model refusal;
- schema validation failure;
- incomplete output;
- webhook failure;
- business-rule rejection;
- stale generation;
- superseded generation.

Do not silently coerce invalid output into apparently valid domain data.

### 5. Centralize volatile AI configuration

Do not scatter across React components:

- model names;
- prompts;
- retry rules;
- schemas;
- provider request construction;
- result normalization;
- safety logic;
- webhook handling.

These concerns belong in:

- backend edge functions;
- shared AI services;
- shared schemas;
- centralized configuration.

Frontend components should consume domain-oriented data contracts.

Do not expose provider-specific details as user-facing product concepts unless they are genuinely
useful.

### 6. Durable long-running AI workflows

AI work that may:

- survive navigation;
- exceed a normal request duration;
- require asynchronous provider processing;
- complete through a webhook;
- need recovery after reload;

must be modeled as a durable server-side workflow.

Use the existing generation infrastructure.

A durable generation flow should:

1. Create or update an authoritative generation record.
2. Expose a stable generation identifier.
3. Store meaningful status transitions.
4. Stream progress through Supabase Realtime.
5. Resume watchers after reload or navigation.
6. Process webhooks idempotently.
7. Support success.
8. Support failure.
9. Support cancellation where available.
10. Support expiration where relevant.
11. Represent superseded generations.
12. Prevent older generations from overwriting newer user decisions.
13. Preserve partial results when the domain allows it.
14. Retain enough metadata for diagnostics without leaking secrets.

Do not represent a durable AI process only with:

```ts
const [isGenerating, setIsGenerating] = useState(false)
```

### 7. Immediate AI feedback

When AI generation begins, the user should see an immediate state change.

Show:

- that generation started;
- what is being generated;
- existing content when possible;
- what remains usable;
- progress or stage information when authoritative;
- failure and retry actions when necessary.

Do not block the whole application unnecessarily.

Do not replace useful existing content with an empty loading screen merely because regeneration is
in progress.

### 8. AI result provenance

Clearly distinguish, where relevant:

- user-authored content;
- imported content;
- AI-generated content;
- AI-edited content;
- validated content;
- unreviewed content.

Do not imply that AI output is authoritative merely because it is structured.

Preserve provenance and revision context when it helps the user review or trust the result.

## Accessibility

Accessibility is a functional requirement.

New and modified interfaces must support:

- keyboard operation;
- visible focus;
- screen readers;
- browser zoom;
- touch input;
- reduced motion;
- semantic structure.

Rules:

- Use actual buttons for actions.
- Use actual links for navigation.
- Do not make a `div` clickable.
- Associate labels with form controls.
- Associate descriptions and errors with their fields.
- Preserve focus when dialogs, sheets, menus, and popovers open or close.
- Use appropriate live announcements when visual feedback alone is insufficient.
- Do not communicate critical state through color alone.
- Do not communicate critical state through an icon alone.
- Do not hide essential information exclusively behind hover.
- Keep icon-only controls accessible with `aria-label`.
- Use Tooltips for secondary explanatory text.
- Respect disabled versus `aria-disabled` semantics.
- Give destructive operations clear object-specific consequences.
- Maintain adequate touch targets.
- Maintain logical heading order.
- Respect `prefers-reduced-motion`.

Using shadcn or Radix does not automatically make the final composition accessible.

Verify the composed behavior.

## Complete state design

Every substantial screen, query, mutation, component, and AI workflow must account for the states
that apply to it.

Consider:

- initial state;
- loading state;
- pending state;
- cached state;
- stale state;
- background-refetch state;
- empty state;
- partial-data state;
- success state;
- validation failure;
- permission failure;
- authentication failure;
- conflict state;
- network failure;
- server failure;
- provider failure;
- rollback state;
- retry state;
- cancellation;
- superseded state;
- interrupted connectivity;
- recovery.

Do not consider a feature complete when only the successful response is rendered.

## Verification and completion

After implementation:

1. Run the narrowest relevant tests first.
2. Run formatting for changed files.
3. Run type checking.
4. Run linting.
5. Run broader relevant tests.
6. Inspect the final diff.
7. Exercise failure behavior.
8. Exercise rollback behavior.
9. Verify navigation behavior.
10. Verify reload behavior.
11. Verify browser back and forward behavior where relevant.
12. Verify permission boundaries.
13. Verify accessibility-sensitive interactions.
14. Verify stale and concurrent request behavior where relevant.
15. Report unverified areas honestly.

Inspect the final diff for:

- generated files edited manually;
- accidental styling drift;
- duplicated abstractions;
- native browser dialogs;
- native DOM `title` attributes;
- direct Supabase calls from components;
- inline query keys;
- unnecessary `useState`;
- unnecessary `useEffect`;
- copied server data in local state;
- incorrect package-manager commands;
- arbitrary hard-coded colors;
- excessive nested surfaces;
- duplicate mutation paths;
- swallowed errors;
- provider-specific logic in React components.

For optimistic mutations, test where relevant:

- delayed success;
- server rejection;
- rollback;
- duplicate interaction;
- concurrent mutations;
- navigation during the request;
- out-of-order completion;
- stale refetches;
- temporary identifiers.

For AI workflows, test where relevant:

- invalid structured output;
- model refusal;
- provider failure;
- webhook duplication;
- stale completion;
- superseded generation;
- navigation during generation;
- reload and watcher resumption;
- partial results;
- permission failure;
- cancellation;
- timeout or expiration.

Never claim that a command, test, migration, deployment, visual check, or documentation check passed
unless it was actually performed.

The final implementation summary must state:

- what changed;
- why the chosen architecture was used;
- which official documentation or project patterns were consulted when relevant;
- what was tested;
- what could not be tested;
- any remaining risks or limitations.

### Mandatory TanStack documentation search

Before implementing, modifying, debugging, or reviewing behavior related to any TanStack library,
consult the current official TanStack documentation through the TanStack CLI.

Use:

```bash
bunx @tanstack/cli search-docs "<search>" --library <library> --framework react --json
```

Examples:

```bash
bunx @tanstack/cli search-docs "validated search params and navigation" \
  --library router \
  --framework react \
  --json

bunx @tanstack/cli search-docs "optimistic mutations rollback concurrent updates" \
  --library query \
  --framework react \
  --json
```

This documentation search is **mandatory when the agent is not completely certain** about the
current API, recommended pattern, available primitive, version-specific behavior, or interaction
between TanStack libraries.

It is also **strongly recommended even when the agent is highly confident**. Confidence or prior
experience is not a substitute for checking the current official documentation.

Run a documentation search before:

- introducing or changing TanStack Router APIs;
- introducing or changing TanStack Query APIs;
- adding custom routing, caching, mutation, retry, invalidation, optimistic-update, pagination,
  loader, search-parameter, or navigation logic;
- using React state or effects for a concern that TanStack may already support;
- implementing a workaround for behavior that may have an official TanStack primitive;
- relying on remembered API signatures or framework behavior;
- concluding that TanStack does not support a required capability.

Use a precise conceptual query rather than searching only for an API name. Include the intended
behavior, constraints, and failure case when useful.

Before writing a custom solution, search for the capability itself. For example, search for:

```bash
bunx @tanstack/cli search-docs \
  "persist filters in URL with validated search params and type-safe navigation" \
  --library router \
  --framework react \
  --json
```

rather than searching only for:

```text
useSearch
```

Use the appropriate library identifier, especially:

```text
router
query
form
table
start
```

When unsure which library identifier is available, inspect the current library catalog first:

```bash
bunx @tanstack/cli libraries --json
```

Treat the CLI output as current first-party documentation context. Reconcile it with:

- the installed package version;
- existing project patterns;
- TypeScript types;
- the package source when necessary.

Do not blindly copy an example when it conflicts with the installed version or the architecture of
this repository.

If the CLI command is unavailable or fails, consult the official TanStack documentation directly
and state that the CLI documentation search could not be completed.

Do not claim that official TanStack documentation was consulted unless the search or equivalent
official documentation review was actually performed.
