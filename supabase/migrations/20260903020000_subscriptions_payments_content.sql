-- Subscriptions, payments, notices, FAQs, usage_logs, api_provider_status

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'cancel_at_period_end')),
  billing_key text,
  portone_customer_id text,
  remaining_credit integer not null default 0 check (remaining_credit >= 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  portone_payment_id text unique,
  amount integer not null check (amount >= 0),
  currency text not null default 'KRW',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  payment_method text,
  paid_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now()
);

create table public.usage_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  connector_id text not null,
  endpoint text not null,
  status_code integer,
  response_time_ms integer,
  error_message text,
  cost_estimate_krw numeric(10, 2) default 0,
  created_at timestamptz not null default now()
);

create table public.api_provider_status (
  id text primary key,
  provider text not null,
  is_healthy boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  avg_response_time_ms integer,
  total_calls_24h integer not null default 0,
  error_rate_24h numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default false,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default extensions.gen_random_uuid(),
  category text not null default 'general',
  question text not null,
  answer text not null,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_status_idx on public.subscriptions (status) where status in ('active', 'past_due');
create index subscriptions_period_end_idx on public.subscriptions (current_period_end) where status = 'active';
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id);
create index usage_logs_user_idx on public.usage_logs (user_id, created_at desc);
create index usage_logs_connector_idx on public.usage_logs (connector_id, created_at desc);
create index usage_logs_analysis_idx on public.usage_logs (analysis_id);
create index notices_published_idx on public.notices (created_at desc) where is_published = true;
create index faqs_published_idx on public.faqs (display_order) where is_published = true;

-- RLS
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.usage_logs enable row level security;
alter table public.api_provider_status enable row level security;
alter table public.notices enable row level security;
alter table public.faqs enable row level security;

-- Grants
revoke all on table public.subscriptions, public.payments, public.usage_logs,
  public.api_provider_status, public.notices, public.faqs from anon, authenticated;

grant select on table public.subscriptions to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.usage_logs to authenticated;
grant select on table public.api_provider_status to authenticated;
grant select on table public.notices to anon, authenticated;
grant select on table public.faqs to anon, authenticated;

-- RLS Policies
create policy "users read own subscription"
on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "users read own payments"
on public.payments for select to authenticated
using ((select auth.uid()) = user_id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin reads all usage logs"
on public.usage_logs for select to authenticated
using (
  (select auth.uid()) = user_id
  or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "anyone reads provider status"
on public.api_provider_status for select to authenticated
using (true);

create policy "anyone reads published notices"
on public.notices for select to anon, authenticated
using (is_published = true or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "anyone reads published faqs"
on public.faqs for select to anon, authenticated
using (is_published = true or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
