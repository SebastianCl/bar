alter table public.profiles
  add column username text;

alter table public.profiles
  add constraint profiles_username_check
  check (
    username is null
    or (
      username = lower(btrim(username))
      and username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    )
  );

create unique index profiles_username_unique
  on public.profiles (username)
  where username is not null;

comment on column public.profiles.username is
  'Unique login name; assigned by the project administrator.';

create or replace function public.get_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select auth_user.email::text
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  where profile.username = lower(btrim(p_username))
    and profile.is_active
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public, authenticated;
grant execute on function public.get_login_email(text) to service_role;
