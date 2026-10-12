-- ============================================================
-- PEAK Functional Fitness — le presenze
--
-- A fine classe il coach apre la lista degli iscritti e spunta chi
-- c'era. La lista parte senza spunte: si segna chi è venuto, non si
-- toglie chi manca.
--
-- Chi può: chi ha il permesso sulle presenze. Un coach però chiude
-- solo le classi che tiene lui; se la classe non ha coach assegnato,
-- tocca all'admin.
--
-- Cosa NON fa, di proposito: non scala gli ingressi dell'abbonamento
-- e non blocca chi non si presenta. Sono due cose ancora da decidere
-- (punti aperti nel documento delle decisioni), e scriverle adesso
-- vorrebbe dire decidere per sbaglio.
--
-- Da eseguire dopo gli altri tredici file.
-- ============================================================


-- ============================================================
-- 1. CHI PUÒ CHIUDERE QUESTA CLASSE
-- ============================================================

create or replace function posso_chiudere(sess uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    ho_permesso('cl_attendance')
    and exists (
      select 1 from sessioni s
      where s.id = sess
        and s.box_id = mio_box()
        -- Il coach chiude le proprie; sulle altre serve il permesso
        -- di gestire le classi.
        and (s.coach_id = auth.uid() or ho_permesso('cl_edit'))
    );
$$;

revoke all on function posso_chiudere(uuid) from public;
grant execute on function posso_chiudere(uuid) to authenticated;


-- ============================================================
-- 2. LA LISTA DA SPUNTARE
-- ============================================================

create or replace function elenco_presenze(sess uuid)
returns table (
  prenotazione_id uuid,
  profilo_id      uuid,
  nome            text,
  cognome         text,
  foto_url        text,
  stato           stato_prenotazione,
  posizione_coda  int,
  walk_in         boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.profilo_id, pr.nome, pr.cognome, pr.foto_url,
    p.stato, p.posizione_coda, p.walk_in
  from prenotazioni p
  join profili pr on pr.id = p.profilo_id
  join sessioni s on s.id = p.sessione_id
  where p.sessione_id = sess
    and s.box_id = mio_box()
    and ho_permesso('cl_attendance')
    and p.stato <> 'disdetta'
  order by
    case p.stato when 'lista_attesa' then 1 else 0 end,
    p.posizione_coda nulls first,
    pr.cognome, pr.nome;
$$;

revoke all on function elenco_presenze(uuid) from public;
grant execute on function elenco_presenze(uuid) to authenticated;


-- ============================================================
-- 3. SPUNTARE E CHIUDERE
--
-- Arriva l'elenco di chi c'era. Tutti gli altri, fra i prenotati,
-- diventano assenti. Chi era in lista d'attesa e non è entrato resta
-- com'è: non si è mai liberato un posto per lui, non è un'assenza
-- sua.
-- ============================================================

create or replace function segna_presenze(sess uuid, presenti uuid[])
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  quanti int;
begin
  if not posso_chiudere(sess) then
    raise exception 'Non puoi confermare le presenze di questa classe.';
  end if;

  update prenotazioni p
  set stato = case
        when p.profilo_id = any(coalesce(presenti, '{}'::uuid[])) then 'presente'
        else 'assente'
      end::stato_prenotazione
  where p.sessione_id = sess
    and p.stato in ('prenotato', 'presente', 'assente');

  -- Chi è stato aggiunto al volo e spuntato resta presente anche se
  -- era in lista d'attesa.
  update prenotazioni p
  set stato = 'presente'
  where p.sessione_id = sess
    and p.stato = 'lista_attesa'
    and p.profilo_id = any(coalesce(presenti, '{}'::uuid[]));

  select count(*) into quanti
  from prenotazioni where sessione_id = sess and stato = 'presente';

  update sessioni
  set presenze_confermate_da = auth.uid(),
      presenze_confermate_il = now()
  where id = sess;

  return quanti;
end;
$$;

revoke all on function segna_presenze(uuid, uuid[]) from public;
grant execute on function segna_presenze(uuid, uuid[]) to authenticated;


-- ============================================================
-- 4. CHI ARRIVA SENZA PRENOTAZIONE
--
-- Si aggiunge solo se c'è posto: la capienza vale anche per chi si
-- presenta sulla porta.
-- ============================================================

create or replace function aggiungi_alla_classe(sess uuid, socio uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  posti    int;
  occupati int;
begin
  if not posso_chiudere(sess) then
    raise exception 'Non puoi modificare questa classe.';
  end if;

  select capienza into posti from sessioni where id = sess for update;

  select count(*) into occupati
  from prenotazioni
  where sessione_id = sess and stato in ('prenotato', 'presente');

  if occupati >= posti then
    raise exception 'La classe è al completo.';
  end if;

  insert into prenotazioni (sessione_id, profilo_id, stato, walk_in, iscritto_da)
  values (sess, socio, 'presente', true, auth.uid())
  on conflict (sessione_id, profilo_id) do update
    set stato = 'presente';
end;
$$;

revoke all on function aggiungi_alla_classe(uuid, uuid) from public;
grant execute on function aggiungi_alla_classe(uuid, uuid) to authenticated;


/** Toglie qualcuno dalla classe: serve a rimediare agli errori. */
create or replace function togli_dalla_classe(sess uuid, socio uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not posso_chiudere(sess) then
    raise exception 'Non puoi modificare questa classe.';
  end if;

  update prenotazioni
  set stato = 'disdetta', disdetta_il = now()
  where sessione_id = sess and profilo_id = socio;
end;
$$;

revoke all on function togli_dalla_classe(uuid, uuid) from public;
grant execute on function togli_dalla_classe(uuid, uuid) to authenticated;


-- ============================================================
-- 4bis. NIENTE PROMOZIONI A COSE FATTE
--
-- Quando si libera un posto, il primo della coda entra. Giusto, ma
-- solo se la lezione non è ancora cominciata: togliendo qualcuno da
-- una classe di ieri, il database promuoveva un socio e gli mandava
-- "sei entrato in classe" per una lezione finita da un giorno.
-- ============================================================

create or replace function promuove_dalla_coda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primo      prenotazioni;
  cominciata boolean;
begin
  if old.stato = 'prenotato' and new.stato = 'disdetta' then
    select inizio_sessione(s.data, s.ora) <= now() into cominciata
    from sessioni s where s.id = new.sessione_id;

    if cominciata then return new; end if;

    select * into primo
    from prenotazioni
    where sessione_id = new.sessione_id and stato = 'lista_attesa'
    order by posizione_coda
    limit 1;

    if primo.id is not null then
      update prenotazioni
         set stato = 'prenotato', posizione_coda = null
       where id = primo.id;

      insert into notifiche (profilo_id, gruppo, titolo, testo)
      values (primo.profilo_id, 'lista_attesa',
              'Sei entrato in classe',
              'Si è liberato un posto: la tua prenotazione è confermata.');
    end if;
  end if;
  return new;
end;
$$;


-- ============================================================
-- 5. LE CLASSI DA CHIUDERE
--
-- Quelle già cominciate e ancora senza conferma: è l'elenco che il
-- coach si trova davanti.
--
-- Ognuno vede solo quelle che può chiudere davvero: un coach le sue,
-- l'admin tutte. Senza questo filtro il coach si troverebbe in elenco
-- classi di altri che poi non riesce a confermare.
-- ============================================================

create or replace function classi_da_chiudere(quanti_giorni int default 7)
returns table (
  sessione_id uuid,
  data        date,
  ora         time,
  nome        text,
  coach       text,
  iscritti    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.data, s.ora, s.nome,
    nullif(trim(coalesce(c.nome, '') || ' ' || coalesce(c.cognome, '')), ''),
    (select count(*)::int from prenotazioni p
      where p.sessione_id = s.id and p.stato = 'prenotato')
  from sessioni s
  left join profili c on c.id = s.coach_id
  where s.box_id = mio_box()
    and s.tipo = 'classe'
    and not s.annullata
    and s.presenze_confermate_il is null
    and inizio_sessione(s.data, s.ora) <= now()
    and s.data >= current_date - greatest(1, least(quanti_giorni, 60))
    and ho_permesso('cl_attendance')
    and (s.coach_id = auth.uid() or ho_permesso('cl_edit'))
  order by s.data desc, s.ora desc;
$$;

revoke all on function classi_da_chiudere(int) from public;
grant execute on function classi_da_chiudere(int) to authenticated;


-- ============================================================
-- 6. LE STATISTICHE PASSANO ALLE PRESENZE VERE
--
-- Come da decisioni: sessioni, serie e confronti si calcolano solo
-- sulle presenze confermate. Finché lo staff non comincia a
-- spuntare, i numeri dei soci partono da zero — è giusto così, prima
-- contavano prenotazioni che nessuno aveva verificato.
-- ============================================================

drop function if exists miei_allenamenti();

create function miei_allenamenti()
returns table (
  questo_mese        int,
  mese_scorso        int,
  variazione         int,
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
  settimana   date := date_trunc('week', oggi)::date;
  cursore     date;
  fila        int := 0;
begin
  fine_prec := least(
    inizio_prec + (giorno - 1),
    (date_trunc('month', oggi) - interval '1 day')::date
  );

  select
    count(*) filter (where p.stato = 'presente' and s.data >= inizio_mese)::int,
    count(*) filter (where p.stato = 'presente'
                       and s.data between inizio_prec and fine_prec)::int,
    count(*) filter (where p.stato in ('prenotato', 'lista_attesa')
                       and inizio_sessione(s.data, s.ora) > now())::int,
    count(*) filter (where p.stato = 'presente')::int,
    min(s.data) filter (where p.stato = 'presente')
  into questo_mese, mese_scorso, in_programma, totale, dal
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where p.profilo_id = io;

  variazione := case
    when mese_scorso > 0
      then round((questo_mese - mese_scorso)::numeric * 100 / mese_scorso)::int
    else null
  end;

  settimana_fatta := exists (
    select 1 from prenotazioni p
    join sessioni s on s.id = p.sessione_id
    where p.profilo_id = io and p.stato = 'presente' and s.data >= settimana
  );

  cursore := case when settimana_fatta then settimana else settimana - 7 end;

  loop
    exit when not exists (
      select 1 from prenotazioni p
      join sessioni s on s.id = p.sessione_id
      where p.profilo_id = io
        and p.stato = 'presente'
        and s.data >= cursore
        and s.data < cursore + 7
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
      and p.stato = 'presente'
      and ss.data >= s.inizio
      and ss.data < s.inizio + 7
  ) n on true
  order by s.inizio;
$$;

revoke all on function mie_settimane(int) from public;
grant execute on function mie_settimane(int) to authenticated;


-- ============================================================
-- 7. CONTROLLO
-- ============================================================

select 'classi da chiudere' as cosa, count(*) as quante from classi_da_chiudere();
