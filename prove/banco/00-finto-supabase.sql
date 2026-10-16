-- Ambiente che imita Supabase quel tanto che basta per provare.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('jwt.sub', true), '')::uuid;
$$;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

-- Il ruolo con cui lavora la chiave segreta del server. Senza, le
-- prove sui permessi del speditore non potrebbero esistere — ed è
-- proprio lì che il 16 ottobre è passato un difetto fino in
-- produzione.
do $$ begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;

grant usage on schema public to service_role;
