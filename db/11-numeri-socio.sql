-- ============================================================
-- PEAK Functional Fitness — i tre numeri del socio
--
-- Settimane di fila, allenamenti del mese, e come va rispetto al
-- mese scorso.
--
-- Sostituisce miei_allenamenti(), che tornava solo dei conteggi.
--
-- Nota: per ora conta le prenotazioni non disdette. Quando lo staff
-- comincerà a spuntare le presenze basterà cambiare una riga qui
-- dentro — 'prenotato' esce dall'elenco — e tutto il resto dell'app
-- non se ne accorge.
--
-- Da eseguire dopo gli altri dieci file.
-- ============================================================

-- La versione di prima tornava altre colonne: PostgreSQL non lascia
-- cambiare la forma di una funzione, va tolta e rifatta.
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
  -- Il confronto è a parità di giorni trascorsi: il 5 del mese non ha
  -- senso paragonarlo a un mese intero.
  giorno      int  := extract(day from oggi)::int;
  inizio_mese date := date_trunc('month', oggi)::date;
  inizio_prec date := (date_trunc('month', oggi) - interval '1 month')::date;
  fine_prec   date;
  settimana   date := date_trunc('week', oggi)::date;   -- lunedì
  partenza    date;
  cursore     date;
  fila        int := 0;
begin
  -- Se il mese scorso era più corto, prendo il suo ultimo giorno.
  fine_prec := least(
    inizio_prec + (giorno - 1),
    (date_trunc('month', oggi) - interval '1 day')::date
  );

  select
    count(*) filter (where s.data between inizio_mese and oggi)::int,
    count(*) filter (where s.data between inizio_prec and fine_prec)::int,
    count(*) filter (where s.data > oggi)::int,
    count(*) filter (where s.data <= oggi)::int,
    min(s.data) filter (where s.data <= oggi)
  into questo_mese, mese_scorso, in_programma, totale, dal
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where p.profilo_id = io
    and p.stato in ('prenotato', 'presente');

  variazione := case
    when mese_scorso > 0
      then round((questo_mese - mese_scorso)::numeric * 100 / mese_scorso)::int
    else null
  end;

  -- Ti sei già allenato in questa settimana?
  settimana_fatta := exists (
    select 1 from prenotazioni p
    join sessioni s on s.id = p.sessione_id
    where p.profilo_id = io
      and p.stato in ('prenotato', 'presente')
      and s.data between settimana and oggi
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
    );
    fila := fila + 1;
    cursore := cursore - 7;
    exit when fila >= 260;   -- cinque anni: oltre è un errore, non una serie
  end loop;

  settimane_di_fila := fila;
  return next;
end;
$$;

revoke all on function miei_allenamenti() from public;
grant execute on function miei_allenamenti() to authenticated;


-- ============================================================
-- CONTROLLO
-- ============================================================

select * from miei_allenamenti();
