-- ============================================================
-- PEAK Functional Fitness — le notifiche sul telefono
--
-- Oggi una notifica finisce dentro la campanella dell'app: chi non
-- apre l'app non la vede. Lezione annullata, posto liberato dalla
-- lista d'attesa: cose che se non si sanno in tempo non servono più.
--
-- Questo file è il primo di due. Qui c'è dove si tengono i telefoni
-- iscritti; nel prossimo ci sarà quello che spedisce davvero.
--
-- ------------------------------------------------------------
-- COS'È UN "TELEFONO ISCRITTO"
--
-- Quando un socio accende le notifiche, il suo browser crea un
-- indirizzo a cui si possono recapitare messaggi, più due chiavi che
-- servono a cifrarli. Quell'indirizzo è lungo, è del browser e non
-- della persona, e cambia da solo ogni tanto: va trattato come una
-- cosa che scade, non come un dato anagrafico.
--
-- Un socio può averne più di uno — telefono e tablet — e sono
-- iscrizioni diverse.
--
-- ------------------------------------------------------------
-- UNA NOTA SU IPHONE
--
-- Su iPhone le notifiche arrivano solo se il socio si è aggiunto
-- l'app alla schermata Home e la apre da lì. Aperta come pagina in
-- Safari, il browser non crea nessun indirizzo: non è un permesso
-- negato, è che la cosa proprio non esiste. Su Android funziona
-- anche dal browser.
--
-- Qui si tiene traccia di come è stata creata l'iscrizione, così si
-- può dire quanti soci sono davvero raggiungibili senza doverlo
-- indovinare.
--
-- Da eseguire dopo gli altri ventotto file.
-- ============================================================


-- ============================================================
-- 1. I TELEFONI
-- ============================================================

create table if not exists push_telefoni (
  id            uuid primary key default gen_random_uuid(),
  profilo_id    uuid not null references profili(id) on delete cascade,

  -- L'indirizzo a cui il browser riceve. È lungo e unico: è lui a
  -- identificare l'iscrizione, non il socio.
  endpoint      text not null unique,

  -- Le due chiavi con cui il messaggio va cifrato. Senza, il
  -- telefono lo rifiuta.
  p256dh        text not null,
  auth          text not null,

  -- Come è stata creata: dall'app aggiunta alla Home oppure dal
  -- browser. Serve a sapere quanti soci sono raggiungibili davvero.
  installata    boolean not null default false,
  descrizione   text,                   -- "iPhone di Simone", a scopo umano

  creata_il     timestamptz not null default now(),
  usata_il      timestamptz,            -- ultimo invio riuscito
  errori        int not null default 0  -- invii falliti di fila
);

create index if not exists push_telefoni_profilo
  on push_telefoni (profilo_id);

comment on table push_telefoni is
  'I telefoni su cui un socio riceve le notifiche. Una riga per '
  'dispositivo, non per persona: telefono e tablet sono due '
  'iscrizioni diverse. L''indirizzo scade da solo ogni tanto, quindi '
  'va trattato come una cosa deperibile.';


-- ============================================================
-- 2. SICUREZZA
--
-- Nessuno legge le iscrizioni degli altri, nemmeno lo staff: un
-- indirizzo di recapito in mano a qualcun altro è un modo per
-- mandare notifiche a nome della palestra. Le scrive solo il
-- proprietario, tramite le funzioni qui sotto.
-- ============================================================

alter table push_telefoni enable row level security;

-- Le tabelle create dopo il primo giorno non ereditano i permessi
-- dati alle altre: senza questa riga la regola qui sotto non
-- servirebbe a niente, perché nessuno arriverebbe nemmeno a leggere.
--
-- Solo lettura, di proposito: scrivere si fa dalle funzioni, che
-- controllano chi sei. Così nemmeno un errore in una schermata può
-- infilare un indirizzo di recapito nella tabella.
grant select on push_telefoni to authenticated;

drop policy if exists "ognuno vede i propri telefoni" on push_telefoni;

create policy "ognuno vede i propri telefoni"
  on push_telefoni for select to authenticated
  using (profilo_id = auth.uid());

-- Nessuna regola di scrittura: si passa dalle funzioni.


-- ============================================================
-- 3. ACCENDERE LE NOTIFICHE SU QUESTO TELEFONO
--
-- Lo stesso telefono può essere riusato da un'altra persona — il
-- tablet della reception, un telefono prestato. Se l'indirizzo c'è
-- già, passa al nuovo proprietario invece di dare errore.
-- ============================================================

create or replace function salva_telefono(
  indirizzo text,
  chiave_p256dh text,
  chiave_auth text,
  e_installata boolean default false,
  come_si_chiama text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  nuovo uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere entrato per accendere le notifiche.';
  end if;

  if coalesce(trim(indirizzo), '') = ''
     or coalesce(trim(chiave_p256dh), '') = ''
     or coalesce(trim(chiave_auth), '') = '' then
    raise exception 'Iscrizione incompleta.';
  end if;

  insert into push_telefoni
    (profilo_id, endpoint, p256dh, auth, installata, descrizione)
  values
    (auth.uid(), indirizzo, chiave_p256dh, chiave_auth,
     coalesce(e_installata, false), come_si_chiama)
  on conflict (endpoint) do update
    set profilo_id  = auth.uid(),
        p256dh      = excluded.p256dh,
        auth        = excluded.auth,
        installata  = excluded.installata,
        descrizione = excluded.descrizione,
        -- Si riparte da zero: se prima falliva, adesso è
        -- un'iscrizione nuova.
        errori      = 0
  returning id into nuovo;

  return nuovo;
end;
$$;

revoke all on function salva_telefono(text, text, text, boolean, text) from public;
grant execute on function salva_telefono(text, text, text, boolean, text)
  to authenticated;


/** Spegnere le notifiche su questo telefono. */
create or replace function togli_telefono(indirizzo text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from push_telefoni
  where endpoint = indirizzo and profilo_id = auth.uid();
$$;

revoke all on function togli_telefono(text) from public;
grant execute on function togli_telefono(text) to authenticated;


/** Questo telefono è acceso? Serve al bottone, per sapere cosa
    scriverci sopra. */
create or replace function telefono_acceso(indirizzo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from push_telefoni
    where endpoint = indirizzo and profilo_id = auth.uid()
  );
$$;

revoke all on function telefono_acceso(text) from public;
grant execute on function telefono_acceso(text) to authenticated;


-- ============================================================
-- 4. QUANTI SOCI SONO RAGGIUNGIBILI
--
-- Il numero che serve prima di annullare una lezione: se la metà dei
-- prenotati non ha le notifiche accese, l'avviso va dato anche in
-- altro modo. Conta persone, non telefoni.
-- ============================================================

create or replace function quanti_raggiungibili()
returns table (
  soci          int,   -- soci approvati
  raggiungibili int,   -- di questi, quanti hanno almeno un telefono
  telefoni      int    -- dispositivi in tutto
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from profili
      where box_id = mio_box() and stato = 'approvato'),
    (select count(distinct t.profilo_id)::int
       from push_telefoni t
       join profili p on p.id = t.profilo_id
      where p.box_id = mio_box() and p.stato = 'approvato'),
    (select count(*)::int
       from push_telefoni t
       join profili p on p.id = t.profilo_id
      where p.box_id = mio_box() and p.stato = 'approvato')
  where ho_permesso('soci_view');
$$;

revoke all on function quanti_raggiungibili() from public;
grant execute on function quanti_raggiungibili() to authenticated;


-- ============================================================
-- 5. CONTROLLO
-- ============================================================

select * from quanti_raggiungibili();
