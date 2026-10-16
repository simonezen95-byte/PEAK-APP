-- Al posto di pg_net.
--
-- Sul banco di prova non c'è internet e non deve esserci: una prova
-- che chiama un server vero non è più una prova, è un collaudo che
-- fallisce quando il server è lento.
--
-- Questo finto net.http_post non chiama nessuno: segna una riga. Che
-- è anche meglio dell'originale, perché le chiamate così si possono
-- contare — ed è esattamente quello che serve verificare, visto che
-- il difetto da cui siamo partiti era dodici chiamate invece di una.

create schema if not exists net;

create table if not exists net.chiamate (
  id     bigserial primary key,
  quando timestamptz not null default clock_timestamp(),
  url    text
);

create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000
)
returns bigint
language sql
as $$
  insert into net.chiamate (url) values (url) returning id;
$$;
