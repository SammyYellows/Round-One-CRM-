-- Shared logins (Sammy, 11/10/2026): when management set a new password on
-- the Staff page, everyone signed in on that login is signed out, so someone
-- who has left can't stay in. Only the server (secret key) can call this.

create or replace function public.revoke_sessions(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = uid;
$$;

revoke all on function public.revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_sessions(uuid) to service_role;
