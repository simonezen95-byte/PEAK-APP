-- ============================================================
-- PEAK Functional Fitness — spedire le notifiche
--
-- Secondo e ultimo pezzo. Il primo ha messo i telefoni nel database;
-- questo fa partire i messaggi.
--
-- ------------------------------------------------------------
-- PERCHÉ UNA CODA E NON UN INVIO DIRETTO
--
-- Spedire vuol dire parlare con un servizio su internet — Google per
-- Android, Apple per iPhone — che può essere lento o non rispondere.
-- Se la spedizione avvenisse dentro la prenotazione, un telefono
-- lento farebbe fallire la prenotazione di un socio.
--
-- Quindi quando nasce una notifica si scrive soltanto una riga in
-- coda: istantaneo, e non può fallire. Spedire è un lavoro a parte,
-- che se va storto si rifà.
--
-- ------------------------------------------------------------
-- QUALI NOTIFICHE ESCONO
--
-- Non tutte: solo quelle in cui non saperlo costa qualcosa. Un
-- allenamento perso, un viaggio a vuoto, un abbonamento scaduto senza
-- accorgersene. Il resto resta nella campanella dell'app, che tanto
-- il socio apre per prenotare.
--
-- L'elenco sta in una tabella e non scritto nel codice, così si
-- cambia senza ripubblicare niente.
--
-- Da eseguire dopo gli altri ventinove file.
-- ============================================================


-- ============================================================
-- 1. QUALI GRUPPI ESCONO DALL'APP
-- ============================================================

create table if not exists push_gruppi (
  gruppo     text primary key,
  esce       boolean not null default true,
  urgenza    text not null default 'normal',   -- 'high' arriva subito
  descrizione text
);

insert into push_gruppi (gruppo, esce, urgenza, descrizione) values
  ('lista_attesa',     true,  'high',
   'Si è liberato un posto: se non lo sa non viene, e il posto resta vuoto.'),
  ('classe_annullata', true,  'high',
   'Se non lo sa si presenta e trova chiuso.'),
  ('promemoria',       true,  'normal',
   'Due ore prima della lezione prenotata.'),
  ('abbonamento',      true,  'normal',
   'Abbonamento o certificato in scadenza.'),
  ('comunicazione',    true,  'normal',
   'Avviso scritto dalla palestra.'),
  ('prenotazioni',     false, 'normal',
   'Conferme di prenotazione: le vede aprendo l''app, non serve un avviso.')
on conflict (gruppo) do nothing;

comment on table push_gruppi is
  'Quali notifiche escono dall''app e quali restano nella campanella. '
  'In tabella e non nel codice: si cambia idea senza ripubblicare.';


-- ============================================================
-- 2. LA CODA
-- ============================================================

create table if not exists coda_push (
  id          bigint primary key generated always as identity,
  telefono_id uuid not null references push_telefoni(id) on delete cascade,
  titolo      text not null,
  testo       text,
  link        text,
  gruppo      text not null,
  urgenza     text not null default 'normal',
  tentativi   int  not null default 0,
  creata_il   timestamptz not null default now(),
  spedita_il  timestamptz,
  errore      text
);

-- Le righe da spedire: quelle non ancora spedite e che non hanno
-- fallito troppe volte. L'indice serve perché questa domanda si fa
-- ogni volta che arriva una notifica.
create index if not exists coda_push_da_fare
  on coda_push (creata_il)
  where spedita_il is null and tentativi < 5;


-- ============================================================
-- 3. QUANDO NASCE UNA NOTIFICA, SI RIEMPIE LA CODA
--
-- Una riga per telefono, non per persona: chi ha telefono e tablet
-- riceve su tutt'e due, ed è giusto così — non sappiamo quale ha in
-- mano.
-- ============================================================

create or replace function accoda_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g push_gruppi;
begin
  select * into g from push_gruppi where gruppo = new.gruppo;

  -- Gruppo sconosciuto o che non esce: resta solo nella campanella.
  if g.gruppo is null or not g.esce then
    return new;
  end if;

  insert into coda_push (telefono_id, titolo, testo, link, gruppo, urgenza)
  select t.id, new.titolo, new.testo, new.link, new.gruppo, g.urgenza
  from push_telefoni t
  join profili p on p.id = t.profilo_id
  where t.profilo_id = new.profilo_id
    -- Il socio può spegnere una famiglia di avvisi dal suo profilo.
    -- Se non ha mai deciso niente, vale acceso.
    and coalesce((p.notifiche ->> new.gruppo)::boolean, true)
    -- Un telefono che ha fallito cinque volte di fila è un telefono
    -- che non c'è più: si smette di provarci.
    and t.errori < 5;

  return new;
end;
$$;

drop trigger if exists notifica_in_coda on notifiche;

create trigger notifica_in_coda
  after insert on notifiche
  for each row execute function accoda_push();


-- ============================================================
-- 4. COSA CHIEDE IL SPEDITORE
--
-- Queste due funzioni le usa il pezzo che gira su Vercel. Restano
-- chiuse a tutti gli altri: chi potesse leggerle avrebbe in mano gli
-- indirizzi di recapito di tutti i soci.
-- ============================================================

create or replace function prossime_push(quante int default 50)
returns table (
  id        bigint,
  endpoint  text,
  p256dh    text,
  auth      text,
  titolo    text,
  testo     text,
  link      text,
  gruppo    text,
  urgenza   text
)
language sql
volatile
security definer
set search_path = public
as $$
  -- Si segna il tentativo mentre si prendono: se il speditore muore
  -- a metà, queste righe non restano a girare all'infinito.
  with prese as (
    update coda_push c
    set tentativi = c.tentativi + 1
    where c.id in (
      select c2.id from coda_push c2
      where c2.spedita_il is null and c2.tentativi < 5
      order by c2.creata_il
      limit greatest(1, least(coalesce(quante, 50), 200))
      for update skip locked
    )
    returning c.*
  )
  select p.id, t.endpoint, t.p256dh, t.auth,
         p.titolo, p.testo, p.link, p.gruppo, p.urgenza
  from prese p
  join push_telefoni t on t.id = p.telefono_id;
$$;

-- Chiusa a tutti, poi riaperta a uno solo.
--
-- "Tutti" qui vuol dire davvero tutti: in PostgreSQL una funzione
-- nuova è eseguibile da chiunque, e togliere il permesso a public lo
-- toglie anche al ruolo con cui lavora il speditore. Va quindi
-- ridato a lui, per nome.
revoke all on function prossime_push(int) from public, anon, authenticated;
grant execute on function prossime_push(int) to service_role;


/** Com'è andata. Se il telefono non esiste più lo si toglie: è la
    cosa che tiene pulita la tabella senza che nessuno ci pensi. */
create or replace function chiudi_push(
  riga bigint,
  andata_bene boolean,
  sparito boolean default false,
  motivo text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tel uuid;
begin
  select telefono_id into tel from coda_push where id = riga;
  if tel is null then return; end if;

  if andata_bene then
    update coda_push set spedita_il = now(), errore = null where id = riga;
    update push_telefoni set usata_il = now(), errori = 0 where id = tel;
  elsif sparito then
    -- App disinstallata, permesso revocato, iscrizione scaduta: non
    -- è un errore da riprovare, è un telefono che non c'è più.
    delete from push_telefoni where id = tel;
  else
    update coda_push set errore = left(coalesce(motivo, ''), 300) where id = riga;
    update push_telefoni set errori = errori + 1 where id = tel;
  end if;
end;
$$;

revoke all on function chiudi_push(bigint, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function chiudi_push(bigint, boolean, boolean, text)
  to service_role;


-- ============================================================
-- 5. PULIZIA
--
-- La coda non è un archivio: le righe spedite servono per qualche
-- giorno a capire cos'è successo, poi sono peso morto.
-- ============================================================

create or replace function pulisci_coda_push()
returns int
language sql
volatile
security definer
set search_path = public
as $$
  with via as (
    delete from coda_push
    where (spedita_il is not null and spedita_il < now() - interval '7 days')
       or (spedita_il is null and tentativi >= 5
           and creata_il < now() - interval '2 days')
    returning 1
  )
  select count(*)::int from via;
$$;

revoke all on function pulisci_coda_push() from public, anon, authenticated;


-- ============================================================
-- 6. CONTROLLO
-- ============================================================

-- Le ultime due righe sono le più importanti: il speditore deve
-- poter chiamare le sue funzioni, e un socio non deve poterlo fare.
select
  (select count(*) from push_gruppi where esce)             as gruppi_che_escono,
  (select count(*) from coda_push where spedita_il is null) as in_attesa,
  has_function_privilege('service_role', 'prossime_push(int)', 'execute')
    as speditore_puo,
  not has_function_privilege('authenticated', 'prossime_push(int)', 'execute')
    as socio_non_puo;
