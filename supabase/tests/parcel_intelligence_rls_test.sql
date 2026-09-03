begin;
select plan(10);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.sites'::regclass), 'sites has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.analyses'::regclass), 'analyses has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.derived_facts'::regclass), 'derived facts has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.analysis_artifacts'::regclass), 'artifacts has RLS');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com', '', now(), now(), now(), '', '', '', '');

insert into public.sites (id, user_id, jibun_address) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '서울 성동구 성수동 1-1'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '서울 성동구 성수동 2-2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}', true);

select results_eq('select count(*) from public.profiles', 'values (1::bigint)', 'user sees only own profile');
select results_eq('select count(*) from public.sites', 'values (1::bigint)', 'user sees only own site');

select throws_ok(
  $$insert into public.sites (user_id, jibun_address) values ('00000000-0000-4000-8000-000000000002', '타인 소유 필지')$$,
  '42501',
  'new row violates row-level security policy for table "sites"',
  'user cannot create a site for another user'
);

select lives_ok(
  $$insert into public.sites (user_id, jibun_address) values ('00000000-0000-4000-8000-000000000001', '본인 소유 필지')$$,
  'user can create own site'
);

reset role;
set local role anon;
select results_eq('select count(*) from public.plans', 'values (3::bigint)', 'anon sees active plans');

select * from finish();
rollback;
