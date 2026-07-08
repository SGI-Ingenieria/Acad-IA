create table if not exists public.observability_test_runs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (
    tipo in ('openai_foreground', 'openai_background', 'webhook_manual')
  ),
  estado text not null default 'pending' check (
    estado in ('pending', 'running', 'completed', 'failed', 'unknown')
  ),
  openai_response_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  latency_ms integer,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists observability_test_runs_started_at_idx
  on public.observability_test_runs (started_at desc);

create index if not exists observability_test_runs_response_id_idx
  on public.observability_test_runs (openai_response_id)
  where openai_response_id is not null;

create table if not exists public.observability_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  openai_response_id text,
  test_run_id uuid references public.observability_test_runs(id)
    on delete set null,
  received_at timestamptz not null default now(),
  signature_valid boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processed', 'ignored', 'failed')
  ),
  processing_error text
);

create index if not exists observability_webhook_events_received_at_idx
  on public.observability_webhook_events (received_at desc);

create index if not exists observability_webhook_events_response_id_idx
  on public.observability_webhook_events (openai_response_id)
  where openai_response_id is not null;

alter table public.observability_test_runs enable row level security;
alter table public.observability_webhook_events enable row level security;

drop policy if exists observability_test_runs_select_admin
  on public.observability_test_runs;
create policy observability_test_runs_select_admin
  on public.observability_test_runs
  for select
  to authenticated
  using (public.authz_is_admin());

drop policy if exists observability_webhook_events_select_admin
  on public.observability_webhook_events;
create policy observability_webhook_events_select_admin
  on public.observability_webhook_events
  for select
  to authenticated
  using (public.authz_is_admin());

grant select on public.observability_test_runs to authenticated;
grant select on public.observability_webhook_events to authenticated;
grant all on public.observability_test_runs to service_role;
grant all on public.observability_webhook_events to service_role;

create or replace function public.observability_public_ping()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ok', true,
    'server_time', now()
  );
$$;

create or replace function public.observability_admin_ping()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ok', public.authz_is_admin(),
    'user_id', auth.uid(),
    'is_admin', public.authz_is_admin(),
    'server_time', now()
  );
$$;

revoke all on function public.observability_public_ping() from public;
revoke all on function public.observability_admin_ping() from public;
grant execute on function public.observability_public_ping()
  to anon, authenticated, service_role;
grant execute on function public.observability_admin_ping()
  to authenticated, service_role;

alter table public.observability_test_runs replica identity full;
alter table public.observability_webhook_events replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'observability_test_runs'
  ) then
    execute 'alter publication supabase_realtime add table public.observability_test_runs';
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'observability_webhook_events'
  ) then
    execute 'alter publication supabase_realtime add table public.observability_webhook_events';
  end if;
end $$;
