-- ============================================================
-- PEAK Functional Fitness — gli avvisi che partono da soli
--
-- I primi due avvisi (lezione annullata, posto che si libera)
-- nascevano da un gesto: qualcuno tocca qualcosa e parte la notifica.
-- Questi tre no. Nessuno li scatena: è il database che guarda
-- l'orologio e se ne accorge.
--
--   promemoria    due ore prima della lezione prenotata
--   abbonamento   cinque giorni prima della scadenza
--   certificato   quindici giorni prima della scadenza
--
-- ------------------------------------------------------------
-- IL PROBLEMA VERO: NON MANDARLA DUE VOLTE
--
-- Un controllo che gira ogni quarto d'ora trova le stesse scadenze
-- ogni quarto d'ora. Senza memoria, un socio col certificato in
-- scadenza riceverebbe quasi millecinquecento notifiche in quindici
-- giorni.
--
-- La memoria è la tabella qui sotto: prima di mandare si segna cosa
-- si sta mandando, e la segnatura fallisce se c'è già. Non è un
-- controllo "guarda se c'è già e poi scrivi" — fra il guardare e lo
-- scrivere due esecuzioni contemporanee passerebbero entrambe. Qui
-- la scrittura stessa è il controllo, e la fa il database.
--
-- ------------------------------------------------------------
-- UNA COSA DA FARE PRIMA, UNA VOLTA SOLA
--
-- Su Supabase, Database → Extensions, accendere pg_cron: è
-- l'orologio. Senza, le funzioni restano qui ma non le chiama
-- nessuno.
--
-- Da eseguire dopo gli altri trentuno file.
-- ============================================================


-- ============================================================
-- 1. UN GRUPPO SUO PER IL CERTIFICATO
--
-- Non dentro "abbonamento": chi un giorno spegnesse gli avvisi del
-- rinnovo si troverebbe spento anche quello del certificato, che è
-- un'altra cosa — senza, in palestra non si entra.
-- ============================================================

insert into push_gruppi (gruppo, esce, urgenza, descrizione) values
  ('certificato', true, 'normal',
   'Certificato medico in scadenza: senza non si può entrare.')
on conflict (gruppo) do nothing;


-- ============================================================
-- 2. IL REGISTRO DI QUELLO CHE È GIÀ USCITO
-- ============================================================

create table if not exists avvisi_mandati (
  -- La chiave dice esattamente di che avviso si tratta: il tipo e la
  -- cosa a cui si riferisce. Due avvisi diversi sulla stessa persona
  -- hanno chiavi diverse, lo stesso avviso ripetuto ha la stessa
  -- chiave e viene rifiutato.
  chiave     text primary key,
  profilo_id uuid not null references profili(id) on delete cascade,
  quando     timestamptz not null default now()
);

create index if not exists avvisi_mandati_quando
  on avvisi_mandati (quando);

alter table avvisi_mandati enable row level security;
-- Nessuna regola e nessun permesso: è roba di servizio, la leggono
-- solo le funzioni qui sotto che girano coi privilegi del database.

comment on table avvisi_mandati is
  'Memoria degli avvisi automatici già partiti, per non mandarli due '
  'volte. La chiave è tipo + cosa riguarda; il vincolo di unicità è '
  'il controllo vero, non un controllo scritto nel codice.';


-- ============================================================
-- 3. PROMEMORIA — due ore prima della lezione
--
-- Non "esattamente due ore prima": "quando mancano meno di due ore e
-- non gliel'ho ancora detto". La differenza conta — se il controllo
-- salta un giro per qualsiasi motivo, con la prima formula il
-- promemoria è perso per sempre, con questa arriva un po' più tardi.
-- ============================================================

create or replace function avvisi_promemoria()
returns int
language sql
volatile
security definer
set search_path = public
as $$
  with candidati as (
    select p.id          as prenotazione,
           p.profilo_id,
           s.nome,
           s.ora
    from prenotazioni p
    join sessioni s on s.id = p.sessione_id
    where p.stato = 'prenotato'
      and not s.annullata
      -- Comincia fra poco ma non è ancora cominciata.
      and inizio_sessione(s.data, s.ora) > now()
      and inizio_sessione(s.data, s.ora) <= now() + interval '2 hours'
      -- Chi prenota quando la lezione è già alle porte sa benissimo
      -- di averla prenotata: ricordarglielo è rumore.
      and p.prenotato_il < inizio_sessione(s.data, s.ora) - interval '2 hours'
  ),
  nuovi as (
    insert into avvisi_mandati (chiave, profilo_id)
    select 'promemoria:' || prenotazione, profilo_id from candidati
    on conflict (chiave) do nothing
    returning chiave
  ),
  da_mandare as (
    select c.* from candidati c
    join nuovi n on n.chiave = 'promemoria:' || c.prenotazione
  ),
  scritte as (
    insert into notifiche (profilo_id, gruppo, titolo, testo)
    select profilo_id, 'promemoria',
           'Promemoria allenamento',
           nome || ' alle ' || to_char(ora, 'HH24:MI')
             || '. Se non puoi venire, disdici dall''app: il posto va a '
             || 'chi è in lista d''attesa.'
    from da_mandare
    returning 1
  )
  select count(*)::int from scritte;
$$;

revoke all on function avvisi_promemoria() from public, anon, authenticated;


-- ============================================================
-- 4. ABBONAMENTO IN SCADENZA — cinque giorni prima
--
-- Si salta chi ha già rinnovato. Il controllo è "esiste un altro
-- abbonamento che finisce dopo questo", non "ne esiste uno che
-- comincia dopo": chi rinnova in anticipo ha due abbonamenti che si
-- sovrappongono, e con la seconda formula verrebbe avvisato lo
-- stesso. Era un errore vero, trovato in sede di prova.
-- ============================================================

create or replace function avvisi_abbonamento()
returns int
language sql
volatile
security definer
set search_path = public
as $$
  with candidati as (
    select a.id as abbonamento, a.profilo_id, a.fine, k.nome
    from abbonamenti a
    join profili p   on p.id = a.profilo_id
    join pacchetti k on k.id = a.pacchetto_id
    where p.stato = 'approvato'
      and a.fine >= current_date
      and a.fine <= current_date + 5
      and not exists (
        select 1 from abbonamenti a2
        where a2.profilo_id = a.profilo_id
          and a2.fine > a.fine
      )
  ),
  nuovi as (
    insert into avvisi_mandati (chiave, profilo_id)
    select 'abbonamento:' || abbonamento, profilo_id from candidati
    on conflict (chiave) do nothing
    returning chiave
  ),
  da_mandare as (
    select c.* from candidati c
    join nuovi n on n.chiave = 'abbonamento:' || c.abbonamento
  ),
  scritte as (
    insert into notifiche (profilo_id, gruppo, titolo, testo)
    select profilo_id, 'abbonamento',
           'Abbonamento in scadenza',
           nome || ' in scadenza il ' || to_char(fine, 'DD/MM')
             || '. Passa in reception per rinnovarlo.'
    from da_mandare
    returning 1
  )
  select count(*)::int from scritte;
$$;

revoke all on function avvisi_abbonamento() from public, anon, authenticated;


-- ============================================================
-- 5. CERTIFICATO IN SCADENZA — quindici giorni prima
--
-- Quindici e non cinque perché un certificato non si rinnova in
-- reception: bisogna prendere appuntamento dal medico.
--
-- La chiave comprende la data di scadenza. Così quando il socio
-- porta il certificato nuovo e fra un anno scade di nuovo, è un
-- avviso diverso e riparte. Con la sola matricola, il secondo anno
-- non lo avviserebbe nessuno.
-- ============================================================

create or replace function avvisi_certificato()
returns int
language sql
volatile
security definer
set search_path = public
as $$
  with candidati as (
    select p.id as profilo_id, p.certificato_scadenza as scade
    from profili p
    where p.stato = 'approvato'
      and p.certificato_scadenza is not null
      and p.certificato_scadenza >= current_date
      and p.certificato_scadenza <= current_date + 15
  ),
  nuovi as (
    insert into avvisi_mandati (chiave, profilo_id)
    select 'certificato:' || profilo_id || ':' || scade, profilo_id
    from candidati
    on conflict (chiave) do nothing
    returning chiave
  ),
  da_mandare as (
    select c.* from candidati c
    join nuovi n
      on n.chiave = 'certificato:' || c.profilo_id || ':' || c.scade
  ),
  scritte as (
    insert into notifiche (profilo_id, gruppo, titolo, testo)
    select profilo_id, 'certificato',
           'Certificato medico in scadenza',
           'Il tuo certificato scade il ' || to_char(scade, 'DD/MM')
             || '. Senza, non potrai allenarti: portane uno nuovo in '
             || 'reception.'
    from da_mandare
    returning 1
  )
  select count(*)::int from scritte;
$$;

revoke all on function avvisi_certificato() from public, anon, authenticated;


-- ============================================================
-- 6. TUTTI E TRE IN UN COLPO
--
-- È questa che chiama l'orologio. Separata dalle tre perché così
-- ognuna si può provare per conto suo.
-- ============================================================

create or replace function manda_avvisi_automatici()
returns table (promemoria int, abbonamenti int, certificati int)
language sql
volatile
security definer
set search_path = public
as $$
  select avvisi_promemoria(), avvisi_abbonamento(), avvisi_certificato();
$$;

revoke all on function manda_avvisi_automatici() from public, anon, authenticated;


-- ============================================================
-- 7. PULIZIA DEL REGISTRO
--
-- Il registro serve a non ripetersi, non a fare storia. Una riga di
-- due mesi fa non impedisce più niente: l'abbonamento a cui si
-- riferiva è scaduto da un pezzo.
--
-- Il certificato fa eccezione e si tiene più a lungo, perché la sua
-- chiave deve restare valida fino a che quella scadenza è passata.
-- ============================================================

create or replace function pulisci_avvisi_mandati()
returns int
language sql
volatile
security definer
set search_path = public
as $$
  with via as (
    delete from avvisi_mandati
    where quando < now() - interval '120 days'
    returning 1
  )
  select count(*)::int from via;
$$;

revoke all on function pulisci_avvisi_mandati() from public, anon, authenticated;


-- ============================================================
-- 8. L'OROLOGIO
--
-- Ogni quarto d'ora. Non ogni minuto: l'unico avviso che ha fretta è
-- il promemoria, e un promemoria che arriva fra le due ore e l'ora e
-- tre quarti prima va benissimo. Quindici minuti vuol dire
-- novantasei controlli al giorno invece di millequattrocento.
--
-- La pulizia una volta al giorno, di notte.
--
-- Se pg_cron non è acceso queste due righe danno errore e il resto
-- del file è già stato eseguito: si accende l'estensione e si
-- rilancia solo questo pezzo.
-- ============================================================

-- Si toglie prima l'eventuale versione precedente, se no rieseguendo
-- il file si accumulano orologi che fanno la stessa cosa.
select cron.unschedule('peak-avvisi')
where exists (select 1 from cron.job where jobname = 'peak-avvisi');

select cron.schedule(
  'peak-avvisi',
  '*/15 * * * *',
  $$select manda_avvisi_automatici()$$
);

select cron.unschedule('peak-pulizia')
where exists (select 1 from cron.job where jobname = 'peak-pulizia');

select cron.schedule(
  'peak-pulizia',
  '30 4 * * *',
  $$select pulisci_avvisi_mandati(), pulisci_coda_push()$$
);


-- ============================================================
-- 9. CONTROLLO
-- ============================================================

select
  (select count(*) from pg_extension where extname = 'pg_cron') = 1
    as orologio_acceso,
  (select count(*) from cron.job where jobname like 'peak-%')
    as lavori_programmati,
  (select count(*) from avvisi_mandati)
    as avvisi_gia_mandati;
