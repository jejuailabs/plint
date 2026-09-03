create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  company_name text,
  segment text check (segment in ('owner', 'architect', 'platform')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly integer not null check (price_monthly >= 0),
  monthly_credit integer not null check (monthly_credit >= 0),
  target_segment text not null,
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  jibun_address text not null,
  road_address text,
  pnu_code text check (pnu_code is null or pnu_code ~ '^[0-9]{19}$'),
  center extensions.geometry(Point, 5179),
  created_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default extensions.gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'collecting', 'regulations', 'modeling', 'feasibility', 'completed', 'failed')),
  pipeline_version text not null default 'parcel-intelligence-v1',
  result jsonb,
  coverage jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status <> 'completed') or (result is not null and completed_at is not null))
);

create table public.derived_facts (
  id uuid primary key default extensions.gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  fact_path text not null,
  value_json jsonb,
  confidence text not null check (confidence in ('verified', 'derived', 'estimated', 'missing')),
  derivation_rule text,
  evidence_snapshot_ids text[] not null default '{}',
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  created_at timestamptz not null default now(),
  unique (analysis_id, fact_path)
);

create table public.analysis_artifacts (
  id uuid primary key default extensions.gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'xlsx', 'glb', 'skp', 'geojson', 'json', 'thumbnail')),
  storage_path text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  generation_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.connector_registry (
  id text primary key,
  label text not null,
  provider text not null,
  dataset_id text not null,
  source_url text not null,
  protocol text not null check (protocol in ('REST', 'WFS', 'WMS', 'WMTS', 'FILE', 'SDK')),
  ingestion_path text not null check (ingestion_path in ('request', 'warehouse', 'render')),
  update_cycle text not null,
  license_code text not null,
  commercial_use text not null check (commercial_use in ('allowed', 'restricted', 'review')),
  derivative_use text not null check (derivative_use in ('allowed', 'restricted', 'review')),
  is_enabled boolean not null default false,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.raw_snapshots (
  id text primary key,
  provider text not null,
  dataset_id text not null,
  source_key text not null,
  payload jsonb,
  storage_path text,
  content_hash text not null,
  observed_at timestamptz not null default now(),
  effective_at timestamptz,
  expires_at timestamptz,
  check (payload is not null or storage_path is not null)
);

create index sites_user_created_idx on public.sites (user_id, created_at desc);
create index sites_pnu_idx on public.sites (pnu_code) where pnu_code is not null;
create index sites_center_idx on public.sites using gist (center);
create index analyses_user_created_idx on public.analyses (user_id, created_at desc);
create index analyses_site_idx on public.analyses (site_id, created_at desc);
create index analyses_status_idx on public.analyses (status) where status not in ('completed', 'failed');
create index derived_facts_analysis_idx on public.derived_facts (analysis_id, fact_path);
create index derived_facts_user_idx on public.derived_facts (user_id);
create index artifacts_analysis_idx on public.analysis_artifacts (analysis_id, created_at desc);
create index artifacts_user_idx on public.analysis_artifacts (user_id);
create index raw_snapshots_lookup_idx on private.raw_snapshots (dataset_id, source_key, effective_at desc);

alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.sites enable row level security;
alter table public.analyses enable row level security;
alter table public.derived_facts enable row level security;
alter table public.analysis_artifacts enable row level security;
alter table public.connector_registry enable row level security;
alter table private.raw_snapshots enable row level security;

revoke all on table public.users, public.plans, public.sites, public.analyses,
  public.derived_facts, public.analysis_artifacts, public.connector_registry from anon, authenticated;
grant select on table public.plans to anon, authenticated;
grant select, update on table public.users to authenticated;
grant select, insert, update, delete on table public.sites to authenticated;
grant select, insert, update, delete on table public.analyses to authenticated;
grant select on table public.derived_facts, public.analysis_artifacts, public.connector_registry to authenticated;

create policy "active plans are public"
on public.plans for select
to anon, authenticated
using (is_active = true);

create policy "users read own profile"
on public.users for select
to authenticated
using ((select auth.uid()) = id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "users update own profile"
on public.users for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users read own sites"
on public.sites for select
to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "users create own sites"
on public.sites for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own sites"
on public.sites for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own sites"
on public.sites for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "users read own analyses"
on public.analyses for select
to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "users create own analyses"
on public.analyses for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sites where sites.id = site_id and sites.user_id = (select auth.uid()))
);

create policy "users update own analyses"
on public.analyses for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own analyses"
on public.analyses for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "users read own derived facts"
on public.derived_facts for select
to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "users read own artifacts"
on public.analysis_artifacts for select
to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "authenticated users read connector status"
on public.connector_registry for select
to authenticated
using (true);

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.plans (code, name, price_monthly, monthly_credit, target_segment, features)
values
  ('starter', 'Starter', 0, 1, 'owner', '["필지 미리보기", "3D 기본 시나리오"]'::jsonb),
  ('pro', 'Professional', 290000, 30, 'architect', '["전체 데이터", "3D 시나리오", "PDF·XLSX·GLB 출력"]'::jsonb),
  ('studio', 'Studio', 490000, 80, 'architect', '["팀 워크스페이스", "화이트라벨 보고서", "우선 처리"]'::jsonb)
on conflict (code) do nothing;
