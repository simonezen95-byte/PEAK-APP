-- ============================================================
-- PEAK Functional Fitness — svegliare il speditore
--
-- La coda si riempie da sola, ma qualcuno deve svuotarla. Questo
-- file fa in modo che il database, appena mette qualcosa in coda,
-- dia una voce al pezzo che gira su Vercel.
--
-- ------------------------------------------------------------
-- DUE COSE DA FARE PRIMA, UNA VOLTA SOLA
--
-- 1. Su Supabase, pagina Database → Extensions, accendere pg_net.
--    È quello che permette al database di chiamare un indirizzo su
--    internet. Senza, questo file dà errore e te ne accorgi subito.
--
-- 2. Scrivere qui sotto l'indirizzo del speditore e la parola
--    d'ordine, nelle due righe segnate. La parola d'ordine deve
--    essere la stessa messa nelle impostazioni di Vercel.
--
-- ------------------------------------------------------------
-- PERCHÉ LA CHIAMATA NON ASPETTA RISPOSTA
--
-- pg_net manda e se ne va: non resta ad aspettare. È voluto. Se
-- aspettasse, una prenotazione resterebbe ferma finché il server
-- non risponde, e un server lento diventerebbe un'app lenta.
--
-- La conseguenza è che il database non sa se la spedizione è
-- riuscita. Non importa: quello che conta è scritto nella coda, e
-- quello che non parte viene ripreso al giro dopo.
--
-- Da sapere: la chiamata non parte nell'istante in cui la si chiede,
-- ma quando l'operazione in corso si chiude bene. È quello che
-- serve — se partisse prima, il speditore guarderebbe in coda e non
-- troverebbe ancora niente. E se l'operazione fallisce a metà, la
-- chiamata non parte affatto: niente notifiche per una prenotazione
-- che poi non c'è stata.
--
-- Da eseguire dopo gli altri trenta file.
-- ============================================================


-- ============================================================
-- 1. DOVE SI TROVA IL SPEDITORE
--
-- In tabella e non scritto dentro la funzione: l'indirizzo cambia se
-- un giorno si cambia hosting, e la parola d'ordine va cambiata se
-- si sospetta che sia in giro. Due righe da aggiornare, non codice
-- da riscrivere.
-- ============================================================

create table if not exists impostazioni_push (
  id        int primary key default 1 check (id = 1),
  indirizzo text not null,
  segreto   text not null,
  attivo    boolean not null default true,

  constraint una_riga_sola check (id = 1)
);

alter table impostazioni_push enable row level security;
-- Nessuna regola e nessun permesso: la legge solo la funzione qui
-- sotto, che gira coi privilegi del database. La parola d'ordine non
-- deve essere raggiungibile da nessun socio, per nessuna strada.


-- ↓↓↓ LE DUE RIGHE DA RIEMPIRE ↓↓↓
insert into impostazioni_push (id, indirizzo, segreto)
values (
  1,
  'https://peakfunctionalfitness.it/api/spedisci',   -- l'indirizzo
  'CAMBIAMI-con-una-parola-lunga-a-caso'             -- la parola d'ordine
)
on conflict (id) do nothing;
-- ↑↑↑ e la stessa parola d'ordine va nelle impostazioni di Vercel ↑↑↑


-- ============================================================
-- 2. LA SVEGLIA
-- ============================================================

create or replace function sveglia_speditore()
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  c impostazioni_push;
begin
  select * into c from impostazioni_push where id = 1;
  if c.indirizzo is null or not c.attivo then
    return;
  end if;

  -- Se pg_net non è acceso questa riga fallisce. Si lascia fallire
  -- in silenzio di proposito: una notifica che non parte è un
  -- problema, una prenotazione che si blocca è un problema più
  -- grosso.
  begin
    perform net.http_post(
      url     := c.indirizzo,
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-peak-segreto', c.segreto
      ),
      body    := '{}'::jsonb
    );
  exception when others then
    raise warning 'Speditore non svegliato: %', sqlerrm;
  end;
end;
$$;

revoke all on function sveglia_speditore() from public, authenticated;


-- ============================================================
-- 3. SI SVEGLIA QUANDO NASCONO LE NOTIFICHE
--
-- UNA CHIAMATA SOLA, NON UNA PER PERSONA
--
-- Annullando una lezione da dodici persone nascono dodici notifiche e
-- dodici righe in coda. Il speditore però le prende tutte insieme —
-- ne svuota fino a cinquanta per volta — quindi di chiamate ne serve
-- una. Le altre undici sarebbero solo soldi di server buttati.
--
-- Perciò due accorgimenti.
--
-- Il primo: la sveglia sta sulle notifiche e non sulla coda. La coda
-- si riempie una riga per volta anche quando le notifiche nascono
-- tutte in un colpo, perché una persona può avere due telefoni.
--
-- Il secondo: un segno messo da parte per tutta la durata
-- dell'operazione. Alla prima sveglia si segna che è fatta, e finché
-- l'operazione non si chiude non se ne manda un'altra. Serve perché
-- certe operazioni creano le notifiche in più riprese — chi annulla
-- libera posti, e chi entra dalla lista d'attesa viene avvisato uno
-- alla volta.
--
-- Il segno sparisce da sé quando l'operazione finisce, riuscita o
-- annullata che sia: non resta niente da pulire.
-- ============================================================

create or replace function sveglia_dopo_notifiche()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Già svegliato in questa operazione: le righe appena nate le
  -- troverà comunque, perché la chiamata parte quando l'operazione
  -- si chiude.
  if coalesce(current_setting('peak.sveglia_mandata', true), '') = 'si' then
    return null;
  end if;

  -- Se nessuna di queste notifiche è di un gruppo che esce dall'app,
  -- non c'è niente da spedire e non si sveglia nessuno. È il caso
  -- delle conferme di prenotazione, che sono anche le più frequenti.
  if not exists (
    select 1
    from nuove n
    join push_gruppi g on g.gruppo = n.gruppo
    where g.esce
  ) then
    return null;
  end if;

  perform set_config('peak.sveglia_mandata', 'si', true);
  perform sveglia_speditore();
  return null;
end;
$$;

-- La vecchia sveglia stava sulla coda e scattava una volta per riga.
drop trigger if exists coda_sveglia on coda_push;
drop function if exists sveglia_dopo_coda();

drop trigger if exists notifiche_sveglia on notifiche;

create trigger notifiche_sveglia
  after insert on notifiche
  referencing new table as nuove
  for each statement execute function sveglia_dopo_notifiche();


-- ============================================================
-- 4. CONTROLLO
--
-- Non prova a spedire: dice solo se le due cose necessarie ci sono.
-- ============================================================

select
  (select count(*) from pg_extension where extname = 'pg_net') = 1
    as pg_net_acceso,
  (select indirizzo from impostazioni_push where id = 1)
    as indirizzo_scritto,
  (select segreto <> 'CAMBIAMI-con-una-parola-lunga-a-caso'
     from impostazioni_push where id = 1)
    as parola_d_ordine_cambiata;
