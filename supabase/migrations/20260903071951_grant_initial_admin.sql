-- Initial PLINT administrator. Authorization is stored in immutable app metadata,
-- never in user-editable user_metadata. The user does not exist yet, so assign the
-- role during their first Auth insert rather than creating an account out of band.
create or replace function private.plint_assign_initial_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) = 'naggu1999@gmail.com' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin');
  end if;
  return new;
end;
$$;

revoke execute on function private.plint_assign_initial_admin() from public, anon, authenticated;

drop trigger if exists plint_assign_initial_admin on auth.users;
create trigger plint_assign_initial_admin
before insert on auth.users
for each row execute function private.plint_assign_initial_admin();

-- Covers a later re-run after the first Google sign-in, while remaining idempotent.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = 'naggu1999@gmail.com';
