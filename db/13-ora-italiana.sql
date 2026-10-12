-- ============================================================
-- PEAK Functional Fitness — l'ora italiana, e cosa vuol dire
--                           "allenamento fatto"
--
-- Due correzioni che vanno insieme.
--
-- PRIMA. Il database ragiona in ora di Greenwich. Una classe salvata
-- come "12:45" veniva quindi confrontata con l'orologio come se
-- fosse le 12:45 di Londra — cioè le 14:45 da noi. Risultato: una
-- lezione risultava "non ancora cominciata" per due ore dopo che era
-- finita, e si sarebbe potuto prenotarla a cose fatte. D'inverno lo
-- scarto è di un'ora, d'estate di due.
--
-- La cura è una funzione sola che mette insieme data e ora dicendo
-- che sono italiane. Tutte le regole che guardano l'orologio passano
-- di lì.
--
-- SECONDA. Un allenamento contava appena arrivava il suo giorno: chi
-- aveva una prenotazione per stasera risultava essersi già allenato
-- stamattina. Ora conta da quando la lezione comincia.
--
-- Da eseguire dopo gli altri dodici file.
-- ============================================================


-- ============================================================
-- 1. QUANDO COMINCIA DAVVERO
-- ============================================================

create or replace function inizio_sessione(giorno date, ora time)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select (giorno + ora) at time zone 'Europe/Rome';
$$;

comment on function inizio_sessione(date, time) is
  'Data e ora di una sessione lette come ora italiana. Da usare '
  'ovunque si confronti una lezione con l''orologio: il database '
  'da solo le leggerebbe come ora di Greenwich.';

grant execute on function inizio_sessione(date, time) to anon, authenticated;


-- ============================================================
-- 2. CHI PUÒ PRENOTARE — stessa regola, ora giusta
-- ============================================================

create or replace function puo_prenotare(socio uuid, sess uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p profili;
  s sessioni;
  quota_ok boolean;
  abb_ok boolean;
begin
  select * into p from profili where id = socio;
  select * into s from sessioni where id = sess;

  if p.id is null or s.id is null then return false; end if;
  if p.stato <> 'approvato' then return false; end if;
  if p.box_id <> s.box_id then return false; end if;
  if s.annullata then return false; end if;

  -- Non si prenota nel passato.
  if inizio_sessione(s.data, s.ora) < now() then return false; end if;

  -- Certificato medico valido il giorno della classe.
  if p.certificato_scadenza is null or p.certificato_scadenza < s.data then
    return false;
  end if;

  -- Quota associativa dell'anno sportivo in corso.
  select exists (
    select 1 from quote q
    where q.profilo_id = socio
      and make_date(q.anno_sportivo, 8, 31) >= s.data
  ) into quota_ok;
  if not quota_ok then return false; end if;

  -- Abbonamento valido il giorno della classe, pagato, con ingressi
  -- residui, e che apra le classi se è una classe.
  select exists (
    select 1
    from abbonamenti a
    join pacchetti k on k.id = a.pacchetto_id
    where a.profilo_id = socio
      and a.tipo = 'abbonamento'
      and a.pagato
      and s.data between a.inizio and a.fine
      and (a.residui is null or a.residui > 0)
      and (s.tipo = 'openbox' or k.include_classi)
  ) into abb_ok;

  return abb_ok;
end;
$$;


-- ============================================================
-- 3. LA DISDETTA — i 15 minuti contati sull'ora giusta
-- ============================================================

drop policy if exists "ognuno disdice le proprie prenotazioni" on prenotazioni;

create policy "ognuno disdice le proprie prenotazioni"
  on prenotazioni for update to authenticated
  using (
    profilo_id = auth.uid()
    and exists (
      select 1 from sessioni s
      where s.id = sessione_id
        and inizio_sessione(s.data, s.ora) > now() + interval '15 minutes'
    )
  );


-- ============================================================
-- 4. I MIEI ALLENAMENTI — contano da quando la lezione comincia
-- ============================================================

drop function if exists miei_allenamenti();

create function miei_allenamenti()
returns table (
  questo_mese        int,
  mese_scorso        int,
  variazione         int,      -- in percentuale; vuoto se il mese scorso è a zero
  settimane_di_fila  int,
  settimana_fatta    boolean,
  in_programma       int,
  totale             int,
  dal                date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  io          uuid := auth.uid();
  oggi        date := current_date;
  giorno      int  := extract(day from oggi)::int;
  inizio_mese date := date_trunc('month', oggi)::date;
  inizio_prec date := (date_trunc('month', oggi) - interval '1 month')::date;
  fine_prec   date;
  settimana   date := date_trunc('week', oggi)::date;   -- lunedì
  partenza    date;
  cursore     date;
  fila        int := 0;
begin
  fine_prec := least(
    inizio_prec + (giorno - 1),
    (date_trunc('month', oggi) - interval '1 day')::date
  );

  -- "fatto" = la lezione è cominciata. Una prenotazione per stasera
  -- non è un allenamento fatto stamattina.
  select
    count(*) filter (where fatto and s.data >= inizio_mese)::int,
    count(*) filter (where fatto and s.data between inizio_prec and fine_prec)::int,
    count(*) filter (where not fatto)::int,
    count(*) filter (where fatto)::int,
    min(s.data) filter (where fatto)
  into questo_mese, mese_scorso, in_programma, totale, dal
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  cross join lateral (
    select inizio_sessione(s.data, s.ora) <= now() as fatto
  ) q
  where p.profilo_id = io
    and p.stato in ('prenotato', 'presente');

  variazione := case
    when mese_scorso > 0
      then round((questo_mese - mese_scorso)::numeric * 100 / mese_scorso)::int
    else null
  end;

  settimana_fatta := exists (
    select 1 from prenotazioni p
    join sessioni s on s.id = p.sessione_id
    where p.profilo_id = io
      and p.stato in ('prenotato', 'presente')
      and s.data >= settimana
      and inizio_sessione(s.data, s.ora) <= now()
  );

  -- Settimane di fila. La settimana in corso non interrompe la serie
  -- finché non è finita: se non ti sei ancora allenato parto da
  -- quella prima.
  partenza := case when settimana_fatta then settimana else settimana - 7 end;
  cursore  := partenza;

  loop
    exit when not exists (
      select 1 from prenotazioni p
      join sessioni s on s.id = p.sessione_id
      where p.profilo_id = io
        and p.stato in ('prenotato', 'presente')
        and s.data >= cursore
        and s.data < cursore + 7
        and inizio_sessione(s.data, s.ora) <= now()
    );
    fila := fila + 1;
    cursore := cursore - 7;
    exit when fila >= 260;
  end loop;

  settimane_di_fila := fila;
  return next;
end;
$$;

revoke all on function miei_allenamenti() from public;
grant execute on function miei_allenamenti() to authenticated;


-- ============================================================
-- 5. LE TACCHE DELLE SETTIMANE — stessa regola
-- ============================================================

create or replace function mie_settimane(quante int default 8)
returns table (
  inizio    date,
  fatta     boolean,
  quanti    int,
  in_corso  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with settimane as (
    select generate_series(
      date_trunc('week', current_date) - ((greatest(1, least(quante, 52)) - 1) * interval '7 days'),
      date_trunc('week', current_date),
      interval '7 days'
    )::date as inizio
  )
  select
    s.inizio,
    coalesce(n.quanti, 0) > 0,
    coalesce(n.quanti, 0)::int,
    s.inizio = date_trunc('week', current_date)::date
  from settimane s
  left join lateral (
    select count(*) as quanti
    from prenotazioni p
    join sessioni ss on ss.id = p.sessione_id
    where p.profilo_id = auth.uid()
      and p.stato in ('prenotato', 'presente')
      and ss.data >= s.inizio
      and ss.data < s.inizio + 7
      and inizio_sessione(ss.data, ss.ora) <= now()
  ) n on true
  order by s.inizio;
$$;

revoke all on function mie_settimane(int) from public;
grant execute on function mie_settimane(int) to authenticated;


-- ============================================================
-- 6. LE ATTIVITÀ DI OGGI — "passata" sull'ora giusta
-- ============================================================

create or replace function attivita_oggi()
returns table (
  sessione_id uuid,
  ora         time,
  durata_min  int,
  tipo        tipo_sessione,
  nome        text,
  capienza    int,
  iscritti    int,
  in_coda     int,
  coach       text,
  annullata   boolean,
  passata     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.ora, s.durata_min, s.tipo, s.nome, s.capienza,
    coalesce(n.prenotati, 0)::int,
    coalesce(n.in_coda, 0)::int,
    nullif(trim(coalesce(c.nome, '') || ' ' || coalesce(c.cognome, '')), ''),
    s.annullata,
    inizio_sessione(s.data, s.ora) < now()
  from sessioni s
  left join profili c on c.id = s.coach_id
  left join lateral (
    select
      count(*) filter (where p.stato in ('prenotato', 'presente')) as prenotati,
      count(*) filter (where p.stato = 'lista_attesa') as in_coda
    from prenotazioni p where p.sessione_id = s.id
  ) n on true
  where s.box_id = mio_box()
    and s.data = current_date
    and ho_permesso('soci_view')
  order by s.ora, s.tipo;
$$;

revoke all on function attivita_oggi() from public;
grant execute on function attivita_oggi() to authenticated;


-- ============================================================
-- 7. CONTROLLO
--
-- Il primo numero è l'orologio del database, il secondo l'ora
-- italiana: devono essere lo stesso istante.
-- ============================================================

select
  now() as adesso,
  inizio_sessione(current_date, '12:45') as lezione_delle_1245,
  inizio_sessione(current_date, '12:45') <= now() as gia_cominciata;
