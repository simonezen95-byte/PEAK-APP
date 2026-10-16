-- Al posto di pg_cron.
--
-- Non serve che l'orologio batta davvero: le funzioni degli avvisi
-- si chiamano a mano nelle prove, ed è meglio così, perché aspettare
-- giovedì mattina per sapere se funziona non è un collaudo.
--
-- Serve invece che le righe `cron.schedule` dei file 32 e 33 non
-- diano errore, e che si possa controllare COSA è stato programmato:
-- un lavoro registrato col giorno sbagliato è un difetto vero, e
-- senza questa tabella non lo vedrebbe nessuno.

create schema if not exists cron;

create table if not exists cron.job (
  jobid    bigserial primary key,
  jobname  text,
  schedule text,
  command  text
);

create or replace function cron.schedule(jobname text, schedule text, command text)
returns bigint
language sql
as $$
  insert into cron.job (jobname, schedule, command)
  values (jobname, schedule, command)
  returning jobid;
$$;

create or replace function cron.unschedule(jobname text)
returns boolean
language sql
as $$
  delete from cron.job where jobname = $1;
  select true;
$$;
