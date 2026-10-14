-- ============================================================
-- PEAK Functional Fitness — l'analisi delle prove
--
-- Quante persone vengono a provare, da dove arrivano, quante si
-- iscrivono. È l'analisi commerciale della palestra: dice se la
-- pubblicità funziona e se la prova viene gestita bene.
--
-- ------------------------------------------------------------
-- DUE DATI NUOVI, NESSUN DATO PERSONALE IN PIÙ
--
-- Una prova resta quello che è: una prenotazione senza nessuno
-- dietro. Niente nome, niente contatto. I contatti stanno sul foglio
-- della reception e lì restano.
--
-- Qui si aggiungono due cose che non identificano nessuno:
--
--   fonte  — da dove è arrivata: una voce di un elenco chiuso.
--            "Instagram" non è una persona.
--   esito  — si è iscritta, sì o no. Una casella, senza nessun
--            collegamento alla scheda del socio che è diventata.
--
-- Il collegamento al socio sarebbe comodo e NON si fa: appena una
-- riga di prova punta a una persona, quella riga diventa un dato
-- personale, e con essa tutto l'archivio delle prove.
--
-- ------------------------------------------------------------
-- IL TASSO DI CONVERSIONE SI CALCOLA SU CHI HA GIÀ DECISO
--
-- Una prova fatta ieri non si è ancora iscritta e non si è ancora
-- persa: è in sospeso. Contarla fra le non convertite abbasserebbe il
-- tasso ogni volta che arriva gente nuova — cioè proprio quando le
-- cose vanno bene. Il denominatore è chi ha un esito segnato.
--
-- Da eseguire dopo gli altri ventisette file.
-- ============================================================


-- ============================================================
-- 1. LE DUE COLONNE
-- ============================================================

alter table prenotazioni
  add column if not exists prova_fonte text;

alter table prenotazioni
  add column if not exists prova_esito boolean;

comment on column prenotazioni.prova_fonte is
  'Da dove è arrivata la persona venuta a provare. È una categoria, '
  'non un dato personale: non identifica nessuno.';

comment on column prenotazioni.prova_esito is
  'Si è iscritta? Vuoto finché non si sa. Nessun collegamento alla '
  'scheda del socio: appena ci fosse, questa riga diventerebbe un '
  'dato personale.';

-- Le due colonne hanno senso solo su una prova. Su una prenotazione
-- di un socio sarebbero rumore, e prima o poi qualcuno le leggerebbe
-- credendoci.
alter table prenotazioni
  drop constraint if exists prenotazioni_prova_dati;

alter table prenotazioni
  add constraint prenotazioni_prova_dati check (
    prova or (prova_fonte is null and prova_esito is null)
  );

-- L'elenco delle provenienze, lo stesso del foglio della reception.
-- Scritto come vincolo e non come tabella a parte: sono sei voci che
-- cambiano una volta ogni tanto, e una tabella per sei righe fisse è
-- una tabella in più da guardare.
alter table prenotazioni
  drop constraint if exists prenotazioni_prova_fonte;

alter table prenotazioni
  add constraint prenotazioni_prova_fonte check (
    prova_fonte is null or prova_fonte in
      ('social', 'internet', 'passaparola', 'amico', 'staff', 'altro')
  );


-- ============================================================
-- 2. AGGIUNGERE UNA PROVA, DICENDO DA DOVE ARRIVA
-- ============================================================

drop function if exists aggiungi_prova(uuid);
drop function if exists aggiungi_prova(uuid, text);

create function aggiungi_prova(sess uuid, fonte text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s        sessioni;
  occupati int;
  nuova    uuid;
begin
  select * into s from sessioni where id = sess for update;

  if s.id is null or s.box_id <> mio_box()
     or not (posso_chiudere(sess) or ho_permesso('cl_roster')) then
    raise exception 'Non puoi aggiungere nessuno a questa classe.';
  end if;

  if s.annullata then
    raise exception 'Questa lezione è annullata.';
  end if;

  select count(*) into occupati
  from prenotazioni
  where sessione_id = sess and stato in ('prenotato', 'presente');

  if occupati >= s.capienza then
    raise exception 'La classe è al completo.';
  end if;

  -- Lo stato dipende da quando siamo. Su una lezione già cominciata
  -- la prova si aggiunge perché la persona è lì davanti: nasce
  -- presente. Su una lezione futura è una prenotazione come le altre.
  insert into prenotazioni (sessione_id, profilo_id, stato, prova,
                            prova_fonte, walk_in, iscritto_da)
  values (
    sess, null,
    case when inizio_sessione(s.data, s.ora) <= now() then 'presente'
         else 'prenotato' end::stato_prenotazione,
    true, nullif(trim(coalesce(fonte, '')), ''), true, auth.uid()
  )
  returning id into nuova;

  return nuova;
end;
$$;

revoke all on function aggiungi_prova(uuid, text) from public;
grant execute on function aggiungi_prova(uuid, text) to authenticated;


/** Segnare com'è andata, giorni o settimane dopo. Si può anche
    tornare indietro: null rimette la prova in sospeso. */
create or replace function segna_esito_prova(riga uuid, diventato boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p prenotazioni;
  s sessioni;
begin
  select * into p from prenotazioni where id = riga;
  if p.id is null or not p.prova then
    raise exception 'Questa non è una prova.';
  end if;

  select * into s from sessioni where id = p.sessione_id;
  if s.box_id <> mio_box() or not ho_permesso('soci_view') then
    raise exception 'Non puoi modificare questa prova.';
  end if;

  update prenotazioni set prova_esito = diventato where id = riga;
end;
$$;

revoke all on function segna_esito_prova(uuid, boolean) from public;
grant execute on function segna_esito_prova(uuid, boolean) to authenticated;


-- ============================================================
-- 3. I NUMERI IN TESTA
-- ============================================================

drop function if exists prove_riassunto(int);

create function prove_riassunto(giorni int default 365)
returns table (
  quante        int,   -- prove fatte nel periodo
  convertite    int,   -- diventate soci
  perse         int,   -- non diventate soci
  in_sospeso    int,   -- esito non ancora segnato
  conversione   int    -- percentuale su chi ha deciso, null se nessuno
)
language sql
stable
security definer
set search_path = public
as $$
  with mie as (
    select p.prova_esito
    from prenotazioni p
    join sessioni s on s.id = p.sessione_id
    where s.box_id = mio_box()
      and p.prova
      and p.stato = 'presente'
      and s.data >= current_date - coalesce(giorni, 365)
  ),
  conti as (
    select
      count(*)::int as quante,
      count(*) filter (where prova_esito)::int as convertite,
      count(*) filter (where prova_esito = false)::int as perse,
      count(*) filter (where prova_esito is null)::int as in_sospeso,
      -- Il denominatore è chi ha deciso. Contando anche chi è ancora
      -- in sospeso, il tasso scenderebbe ogni volta che arriva gente
      -- nuova: cioè proprio quando le cose vanno bene.
      case when count(*) filter (where prova_esito is not null) = 0 then null
           else round(
             100.0 * count(*) filter (where prova_esito)
                   / count(*) filter (where prova_esito is not null)
           )::int
      end as conversione
    from mie
  )
  -- Il controllo del permesso sta FUORI dal conteggio.
  -- Messo dentro, un conteggio su zero righe risponde comunque con
  -- una riga di zeri, e chi non ha il permesso vedrebbe una schermata
  -- di zeri invece di non vedere niente.
  select * from conti where ho_permesso('soci_view');
$$;

revoke all on function prove_riassunto(int) from public;
grant execute on function prove_riassunto(int) to authenticated;


-- ============================================================
-- 4. MESE PER MESE
-- ============================================================

drop function if exists prove_per_mese(int);

create function prove_per_mese(quanti_mesi int default 12)
returns table (
  mese        date,
  quante      int,
  convertite  int
)
language sql
stable
security definer
set search_path = public
as $$
  with mesi as (
    select generate_series(
      date_trunc('month', current_date)::date
        - ((coalesce(quanti_mesi, 12) - 1) || ' months')::interval,
      date_trunc('month', current_date)::date,
      '1 month'
    )::date as m
  ),
  prove as (
    select date_trunc('month', s.data)::date as m, p.prova_esito
    from prenotazioni p
    join sessioni s on s.id = p.sessione_id
    where s.box_id = mio_box() and p.prova and p.stato = 'presente'
  )
  select
    mesi.m,
    -- I mesi vuoti restano in elenco: un mese a zero è
    -- un'informazione, e saltarlo nasconderebbe proprio il buco.
    coalesce((select count(*) from prove where prove.m = mesi.m), 0)::int,
    coalesce((select count(*) from prove
               where prove.m = mesi.m and prove.prova_esito), 0)::int
  from mesi
  where ho_permesso('soci_view')
  order by mesi.m;
$$;

revoke all on function prove_per_mese(int) from public;
grant execute on function prove_per_mese(int) to authenticated;


-- ============================================================
-- 5. DA DOVE ARRIVANO
--
-- Il numero che dice se la pubblicità funziona. E attenzione a
-- leggerlo: la fonte che porta più gente non è per forza quella che
-- porta più soci, ed è il secondo numero quello che conta.
-- ============================================================

drop function if exists prove_per_fonte(int);

create function prove_per_fonte(giorni int default 365)
returns table (
  fonte        text,
  quante       int,
  convertite   int,
  conversione  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.prova_fonte, 'non indicata'),
    count(*)::int,
    count(*) filter (where p.prova_esito)::int,
    case when count(*) filter (where p.prova_esito is not null) = 0 then null
         else round(
           100.0 * count(*) filter (where p.prova_esito)
                 / count(*) filter (where p.prova_esito is not null)
         )::int
    end
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where s.box_id = mio_box()
    and p.prova
    and p.stato = 'presente'
    and s.data >= current_date - coalesce(giorni, 365)
    and ho_permesso('soci_view')
  group by coalesce(p.prova_fonte, 'non indicata')
  order by count(*) desc;
$$;

revoke all on function prove_per_fonte(int) from public;
grant execute on function prove_per_fonte(int) to authenticated;


-- ============================================================
-- 6. L'ELENCO, PER SEGNARE GLI ESITI
--
-- Senza nomi, perché non ce ne sono. Data e provenienza bastano a
-- ritrovare la riga sul foglio della reception.
-- ============================================================

drop function if exists prove_elenco(int);

create function prove_elenco(quante int default 60)
returns table (
  id       uuid,
  quando   date,
  ora      time,
  classe   text,
  fonte    text,
  esito    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, s.data, s.ora, s.nome, p.prova_fonte, p.prova_esito
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where s.box_id = mio_box()
    and p.prova
    and p.stato = 'presente'
    and ho_permesso('soci_view')
  -- Prima quelle senza esito, poi le più recenti: in cima il lavoro
  -- da fare, non la cronologia.
  order by (p.prova_esito is not null), s.data desc, s.ora desc
  limit greatest(1, least(coalesce(quante, 60), 300));
$$;

revoke all on function prove_elenco(int) from public;
grant execute on function prove_elenco(int) to authenticated;


-- ============================================================
-- 7. CONTROLLO
-- ============================================================

select * from prove_riassunto(365);
