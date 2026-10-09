-- ============================================================
-- PEAK Functional Fitness — il WOD
--
-- Un WOD al giorno per palestra, con una o più versioni: RX
-- obbligatoria, Scaled e Open facoltative. I movimenti sono righe
-- di testo libere, non un elenco di esercizi codificati: un coach
-- scrive più in fretta di quanto scelga da un menù.
--
-- Il riscaldamento sta sul WOD ma non arriva nell'app dei soci:
-- si vede sullo schermo in sala e nella console.
--
-- Da eseguire dopo gli altri sei file.
-- ============================================================


-- ============================================================
-- 1. SALVARE UN WOD IN UN COLPO SOLO
--
-- Il WOD e le sue versioni stanno in due archivi. Salvandoli con
-- due scritture separate, se la seconda fallisce resta un WOD
-- senza movimenti. Qui o si salva tutto o non cambia niente.
--
-- "varianti" arriva così: {"RX": "21-15-9\nThruster 43kg\nPull up",
--                          "SCALED": "..."}
-- Le versioni non passate vengono tolte.
-- ============================================================

create or replace function salva_wod(
  giorno      date,
  p_titolo    text,
  p_tipo      tipo_score,
  p_time_cap  text,
  p_warm_up   text,
  p_varianti  jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  box   uuid;
  w_id  uuid;
  chiave text;
begin
  if not ho_permesso('wod_write') then
    raise exception 'Non hai il permesso di scrivere il WOD.';
  end if;

  box := mio_box();
  if box is null then
    raise exception 'Palestra non trovata.';
  end if;

  if p_varianti is null or not (p_varianti ? 'RX')
     or length(trim(p_varianti->>'RX')) = 0 then
    raise exception 'La versione RX è obbligatoria.';
  end if;

  insert into wod (box_id, data, titolo, tipo_score, time_cap, warm_up, autore_id)
  values (box, giorno, p_titolo, p_tipo, nullif(trim(p_time_cap), ''),
          nullif(trim(p_warm_up), ''), auth.uid())
  on conflict (box_id, data) do update
    set titolo       = excluded.titolo,
        tipo_score   = excluded.tipo_score,
        time_cap     = excluded.time_cap,
        warm_up      = excluded.warm_up,
        modificato_da = auth.uid(),
        modificato_il = now()
  returning id into w_id;

  -- Le versioni passate: aggiornate o create.
  for chiave in select jsonb_object_keys(p_varianti) loop
    if length(trim(coalesce(p_varianti->>chiave, ''))) > 0 then
      insert into wod_varianti (wod_id, variante, testo)
      values (w_id, chiave::variante_wod, trim(p_varianti->>chiave))
      on conflict (wod_id, variante) do update set testo = excluded.testo;
    end if;
  end loop;

  -- Le versioni non più passate (o svuotate): tolte.
  delete from wod_varianti v
  where v.wod_id = w_id
    and (
      not (p_varianti ? v.variante::text)
      or length(trim(coalesce(p_varianti->>v.variante::text, ''))) = 0
    );

  return w_id;
end;
$$;

revoke all on function salva_wod(date, text, tipo_score, text, text, jsonb) from public;
grant execute on function salva_wod(date, text, tipo_score, text, text, jsonb) to authenticated;


create or replace function cancella_wod(giorno date)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not ho_permesso('wod_write') then
    raise exception 'Non hai il permesso di scrivere il WOD.';
  end if;
  delete from wod where box_id = mio_box() and data = giorno;
end;
$$;

revoke all on function cancella_wod(date) from public;
grant execute on function cancella_wod(date) to authenticated;


-- ============================================================
-- 2. IL WOD COME LO VEDE IL SOCIO
--
-- Senza riscaldamento: quello resta per la sala e per la console.
-- Allo staff il riscaldamento lo dà la funzione qui sotto.
-- ============================================================

create or replace function wod_giorno(giorno date default current_date)
returns table (
  wod_id       uuid,
  data         date,
  titolo       text,
  tipo_score   tipo_score,
  time_cap     text,
  warm_up      text,
  varianti     jsonb,
  mio_score    numeric,
  mia_variante variante_wod,
  quanti_score int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id, w.data, w.titolo, w.tipo_score, w.time_cap,
    -- Il riscaldamento solo a chi sta dall'altra parte del bancone.
    case when sono_staff() then w.warm_up else null end,
    coalesce(
      (select jsonb_object_agg(v.variante, v.testo)
         from wod_varianti v where v.wod_id = w.id),
      '{}'::jsonb),
    mio.valore,
    mio.variante,
    (select count(*)::int from wod_score s where s.wod_id = w.id)
  from wod w
  left join wod_score mio on mio.wod_id = w.id and mio.profilo_id = auth.uid()
  where w.box_id = mio_box()
    and w.data = giorno
    and sono_approvato();
$$;

revoke all on function wod_giorno(date) from public;
grant execute on function wod_giorno(date) to authenticated;


/** In quali giorni di questo periodo c'è un WOD: serve a mettere il
    pallino sul calendario senza scaricare tutti i WOD. */
create or replace function wod_giorni(dal date, al date)
returns table (data date)
language sql
stable
security definer
set search_path = public
as $$
  select w.data from wod w
  where w.box_id = mio_box()
    and w.data between dal and al
    and sono_approvato()
  order by w.data;
$$;

revoke all on function wod_giorni(date, date) from public;
grant execute on function wod_giorni(date, date) to authenticated;


-- ============================================================
-- 3. LA CLASSIFICA DEL GIORNO
--
-- Nel tempo vince chi ci mette meno, nelle ripetizioni e nel carico
-- chi fa di più. Gli score messi in privato non compaiono, tranne
-- il proprio e per lo staff.
-- ============================================================

create or replace function wod_classifica(giorno date default current_date)
returns table (
  profilo_id uuid,
  nome       text,
  cognome    text,
  foto_url   text,
  variante   variante_wod,
  valore     numeric,
  privato    boolean,
  sono_io    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.profilo_id, p.nome, p.cognome, p.foto_url,
    s.variante, s.valore, s.privato,
    s.profilo_id = auth.uid()
  from wod_score s
  join wod w  on w.id = s.wod_id
  join profili p on p.id = s.profilo_id
  where w.box_id = mio_box()
    and w.data = giorno
    and sono_approvato()
    and (s.privato = false or s.profilo_id = auth.uid() or sono_staff())
  order by
    -- RX prima, poi Scaled, poi Open: confrontare un RX con uno
    -- Scaled non vuol dire niente.
    case s.variante when 'RX' then 0 when 'SCALED' then 1 else 2 end,
    case when w.tipo_score = 'tempo' then s.valore end asc nulls last,
    case when w.tipo_score <> 'tempo' then s.valore end desc nulls last;
$$;

revoke all on function wod_classifica(date) from public;
grant execute on function wod_classifica(date) to authenticated;


-- ============================================================
-- 4. CONTROLLO
-- ============================================================

select 'WOD in archivio' as cosa, count(*) as righe from wod;
