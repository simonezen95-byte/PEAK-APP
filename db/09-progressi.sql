-- ============================================================
-- PEAK Functional Fitness — i progressi del socio
--
-- Due cose che il socio guarda nel tempo: i massimali sugli
-- esercizi e i risultati dei WOD.
--
-- I massimali si registrano uno sopra l'altro: ogni tentativo è una
-- riga nuova con la sua data, così resta la storia e non solo il
-- numero di oggi. Qui sotto le funzioni che, di quella storia,
-- tirano fuori il meglio.
--
-- Da eseguire dopo gli altri otto file.
-- ============================================================


-- ============================================================
-- 1. I MIEI MASSIMALI
--
-- Il migliore per ogni esercizio e per ogni tipo (1RM, 3RM, 5RM…),
-- con la data in cui l'hai fatto e da quanto non lo tocchi.
-- ============================================================

create or replace function miei_massimali()
returns table (
  esercizio_id uuid,
  esercizio    text,
  categoria    text,
  tipo         tipo_massimale,
  valore       numeric,
  data         date,
  quanti       int
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.esercizio_id, p.tipo)
    p.esercizio_id,
    e.nome,
    e.categoria,
    p.tipo,
    p.valore,
    p.data,
    (select count(*)::int from pr x
      where x.profilo_id = p.profilo_id
        and x.esercizio_id = p.esercizio_id
        and x.tipo = p.tipo)
  from pr p
  join esercizi e on e.id = p.esercizio_id
  where p.profilo_id = auth.uid()
  -- Il migliore; a parità di peso, il più recente.
  order by p.esercizio_id, p.tipo, p.valore desc, p.data desc;
$$;

revoke all on function miei_massimali() from public;
grant execute on function miei_massimali() to authenticated;


/** Tutti i tentativi su un esercizio, dal più recente. */
create or replace function storico_massimale(esercizio uuid, p_tipo tipo_massimale)
returns table (
  id      uuid,
  valore  numeric,
  data    date,
  privato boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.valore, p.data, p.privato
  from pr p
  where p.profilo_id = auth.uid()
    and p.esercizio_id = esercizio
    and p.tipo = p_tipo
  order by p.data desc, p.creato_il desc;
$$;

revoke all on function storico_massimale(uuid, tipo_massimale) from public;
grant execute on function storico_massimale(uuid, tipo_massimale) to authenticated;


-- ============================================================
-- 2. I MIEI RISULTATI NEI WOD
-- ============================================================

create or replace function mio_storico_wod(limite int default 30)
returns table (
  data       date,
  titolo     text,
  tipo_score tipo_score,
  variante   variante_wod,
  valore     numeric,
  privato    boolean,
  posizione  int,
  su_quanti  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.data, w.titolo, w.tipo_score, s.variante, s.valore, s.privato,
    -- Com'è andata rispetto agli altri, a parità di versione.
    (select count(*)::int + 1
       from wod_score a
      where a.wod_id = s.wod_id
        and a.variante = s.variante
        and case when w.tipo_score = 'tempo'
                 then a.valore < s.valore
                 else a.valore > s.valore end),
    (select count(*)::int
       from wod_score b
      where b.wod_id = s.wod_id and b.variante = s.variante)
  from wod_score s
  join wod w on w.id = s.wod_id
  where s.profilo_id = auth.uid()
    and w.box_id = mio_box()
  order by w.data desc
  limit greatest(1, least(limite, 200));
$$;

revoke all on function mio_storico_wod(int) from public;
grant execute on function mio_storico_wod(int) to authenticated;


-- ============================================================
-- 3. QUANTO MI SONO ALLENATO
--
-- Per ora conta le prenotazioni non disdette. Quando lo staff
-- comincerà a spuntare le presenze, questa funzione passerà a
-- contare quelle e basta: il resto dell'app non se ne accorgerà.
-- ============================================================

create or replace function miei_allenamenti()
returns table (
  questo_mese int,
  in_programma int,
  totale      int,
  dal         date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where s.data >= date_trunc('month', current_date)::date
                       and s.data <= current_date)::int,
    count(*) filter (where s.data > current_date)::int,
    count(*) filter (where s.data <= current_date)::int,
    min(s.data) filter (where s.data <= current_date)
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where p.profilo_id = auth.uid()
    and p.stato in ('prenotato', 'presente');
$$;

revoke all on function miei_allenamenti() from public;
grant execute on function miei_allenamenti() to authenticated;


-- ============================================================
-- 4. CONTROLLO
-- ============================================================

select 'esercizi in libreria' as cosa, count(*) as righe from esercizi;
