-- ============================================================
-- PEAK Functional Fitness — le ultime settimane, una per una
--
-- Serve alla fiamma della serie: sotto al numero c'è una tacca per
-- settimana, accesa se ti sei allenato. L'ultima è quella in corso,
-- e resta vuota finché non la alimenti.
--
-- Da eseguire dopo gli altri undici file.
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
      and ss.data <= current_date
  ) n on true
  order by s.inizio;
$$;

revoke all on function mie_settimane(int) from public;
grant execute on function mie_settimane(int) to authenticated;


-- ============================================================
-- CONTROLLO
-- ============================================================

select to_char(inizio, 'DD/MM') as settimana, fatta, quanti, in_corso
from mie_settimane();
