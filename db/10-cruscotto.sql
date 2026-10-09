-- ============================================================
-- PEAK Functional Fitness — la situazione di oggi
--
-- Quello che chi apre il box la mattina vuole sapere in tre
-- secondi: quanti soci sono in regola, chi aspetta di essere
-- approvato, quante classi ci sono oggi e quanto sono piene.
--
-- Tre funzioni, perché chiedere al telefono di contare righe su
-- quattro archivi vorrebbe dire scaricarseli tutti.
--
-- Da eseguire dopo gli altri nove file.
-- ============================================================


-- ============================================================
-- 1. I NUMERI DI OGGI
-- ============================================================

create or replace function cruscotto()
returns table (
  soci_in_regola   int,
  da_approvare     int,
  nuovi_del_mese   int,
  classi_oggi      int,
  posti_oggi       int,
  prenotati_oggi   int,
  openbox_oggi     int
)
language sql
stable
security definer
set search_path = public
as $$
  with mie_sessioni as (
    select s.id, s.tipo, s.capienza
    from sessioni s
    where s.box_id = mio_box()
      and s.data = current_date
      and not s.annullata
  ),
  conteggi as (
    select p.sessione_id, count(*) as quanti
    from prenotazioni p
    join mie_sessioni m on m.id = p.sessione_id
    where p.stato in ('prenotato', 'presente')
    group by p.sessione_id
  )
  select
    (select count(*)::int from profili p
      where p.box_id = mio_box()
        and p.stato = 'approvato'
        and p.certificato_scadenza >= current_date
        and exists (select 1 from quote q
                     where q.profilo_id = p.id
                       and make_date(q.anno_sportivo, 8, 31) >= current_date)
        and exists (select 1 from abbonamenti a
                     where a.profilo_id = p.id
                       and a.tipo = 'abbonamento'
                       and a.pagato
                       and current_date between a.inizio and a.fine
                       and (a.residui is null or a.residui > 0))),
    (select count(*)::int from profili p
      where p.box_id = mio_box() and p.stato = 'in_attesa'),
    (select count(*)::int from profili p
      where p.box_id = mio_box()
        and p.iscritto_il >= date_trunc('month', current_date)),
    (select count(*)::int from mie_sessioni where tipo = 'classe'),
    (select coalesce(sum(capienza), 0)::int from mie_sessioni where tipo = 'classe'),
    (select coalesce(sum(c.quanti), 0)::int
       from conteggi c join mie_sessioni m on m.id = c.sessione_id
      where m.tipo = 'classe'),
    (select coalesce(sum(c.quanti), 0)::int
       from conteggi c join mie_sessioni m on m.id = c.sessione_id
      where m.tipo = 'openbox')
  where ho_permesso('soci_view');
$$;

revoke all on function cruscotto() from public;
grant execute on function cruscotto() to authenticated;


-- ============================================================
-- 2. LE ATTIVITÀ DI OGGI
--
-- Dalla prossima in poi: quelle già passate non servono a chi sta
-- guardando adesso.
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
    (s.data + s.ora) < now()
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
-- 3. L'ANDAMENTO DEGLI ULTIMI GIORNI
--
-- Una riga per giorno, anche per i giorni a zero: un grafico con
-- i buchi non si legge.
-- ============================================================

create or replace function andamento(giorni int default 7)
returns table (
  data    date,
  quante  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.giorno::date,
    (select count(*)::int
       from prenotazioni p
       join sessioni s on s.id = p.sessione_id
      where s.box_id = mio_box()
        and s.data = g.giorno::date
        and p.stato in ('prenotato', 'presente'))
  from generate_series(
         current_date - (greatest(1, least(giorni, 60)) - 1),
         current_date,
         interval '1 day') as g(giorno)
  where ho_permesso('soci_view')
  order by 1;
$$;

revoke all on function andamento(int) from public;
grant execute on function andamento(int) to authenticated;


-- ============================================================
-- 4. CONTROLLO
-- ============================================================

select * from cruscotto();
