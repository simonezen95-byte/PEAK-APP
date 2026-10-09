-- ============================================================
-- PEAK Functional Fitness — quello che serve alla reception
--
-- Due cose:
--   1. l'elenco dei soci con, accanto a ogni nome, le tre cose che
--      contano: certificato, quota, abbonamento;
--   2. le firme automatiche — chi ha approvato e quando, chi ha
--      registrato il certificato e quando — perché un dato che
--      riempie l'app a mano prima o poi resta vuoto.
--
-- Da eseguire dopo gli altri cinque file.
-- ============================================================


-- ============================================================
-- 1. LE FIRME SI METTONO DA SOLE
-- ============================================================

create or replace function firma_decisioni_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chi uuid := auth.uid();
begin
  if chi is null then return new; end if;

  -- Approvazione
  if new.stato = 'approvato' and old.stato is distinct from 'approvato' then
    new.approvato_da := chi;
    new.approvato_il := now();
  end if;

  -- Certificato medico
  if new.certificato_scadenza is distinct from old.certificato_scadenza
     and new.certificato_scadenza is not null then
    new.certificato_registrato_da := chi;
    new.certificato_registrato_il := now();
  end if;

  -- Entrata nello staff
  if new.ruolo <> 'socio' and old.ruolo = 'socio' and new.staff_dal is null then
    new.staff_dal := current_date;
  end if;

  return new;
end;
$$;

drop trigger if exists firma_decisioni_staff on profili;
create trigger firma_decisioni_staff
  before update on profili
  for each row
  execute function firma_decisioni_staff();


-- ============================================================
-- 2. L'ELENCO DEI SOCI
--
-- Una riga per socio con tutto quello che serve a decidere in
-- reception, senza dover aprire ogni scheda.
--
-- Perché una funzione e non tre letture separate: altrimenti il
-- telefono scaricherebbe l'archivio dei soci, quello delle quote e
-- quello degli abbonamenti e li incrocerebbe da solo, con una
-- chiamata per ogni socio.
-- ============================================================

create or replace function soci_elenco(cerca text default null)
returns table (
  id                    uuid,
  nome                  text,
  cognome               text,
  email                 text,
  telefono              text,
  numero_tessera        int,
  stato                 stato_profilo,
  ruolo                 ruolo_profilo,
  iscritto_il           timestamptz,
  certificato_scadenza  date,
  quota_fino            date,
  abbonamento           text,
  abbonamento_fine      date,
  residui               int,
  in_regola             boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nome, p.cognome, p.email, p.telefono, p.numero_tessera,
    p.stato, p.ruolo, p.iscritto_il,
    p.certificato_scadenza,
    q.fino,
    k.nome,
    a.fine,
    a.residui,
    -- "In regola" vuol dire che oggi potrebbe prenotare.
    (p.stato = 'approvato'
     and p.certificato_scadenza is not null
     and p.certificato_scadenza >= current_date
     and q.fino is not null and q.fino >= current_date
     and a.id is not null)
  from profili p
  left join lateral (
    select max(make_date(anno_sportivo, 8, 31)) as fino
    from quote where profilo_id = p.id
  ) q on true
  left join lateral (
    select * from abbonamenti x
    where x.profilo_id = p.id
      and x.tipo = 'abbonamento'
      and x.pagato
      and current_date between x.inizio and x.fine
      and (x.residui is null or x.residui > 0)
    order by x.fine desc
    limit 1
  ) a on true
  left join pacchetti k on k.id = a.pacchetto_id
  where p.box_id = mio_box()
    and ho_permesso('soci_view')
    and (
      cerca is null or cerca = ''
      or p.nome    ilike '%' || cerca || '%'
      or p.cognome ilike '%' || cerca || '%'
      or p.email   ilike '%' || cerca || '%'
    )
  order by
    case p.stato when 'in_attesa' then 0 else 1 end,
    p.cognome, p.nome;
$$;

revoke all on function soci_elenco(text) from public;
grant execute on function soci_elenco(text) to authenticated;


-- ============================================================
-- 3. LA SCHEDA DI UN SOCIO VISTA DALLA RECEPTION
--
-- Lo storico di quote e abbonamenti di una persona sola.
-- ============================================================

create or replace function socio_storico(socio uuid)
returns table (
  genere      text,      -- 'quota' oppure 'abbonamento'
  descrizione text,
  dal         date,
  al          date,
  residui     int,
  totali      int,
  pagato      boolean,
  quando      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select 'abbonamento', k.nome, a.inizio, a.fine, a.residui, a.totali,
         a.pagato, a.creato_il
  from abbonamenti a
  join pacchetti k on k.id = a.pacchetto_id
  join profili p on p.id = a.profilo_id
  where a.profilo_id = socio
    and p.box_id = mio_box()
    and ho_permesso('abb_view')

  union all

  select 'quota',
         'Stagione ' || q.anno_sportivo,
         make_date(q.anno_sportivo - 1, 9, 1),
         make_date(q.anno_sportivo, 8, 31),
         null, null, true,
         q.versata_il::timestamptz
  from quote q
  join profili p on p.id = q.profilo_id
  where q.profilo_id = socio
    and p.box_id = mio_box()
    and ho_permesso('abb_view')

  -- La terza colonna è "dal": in una unione i nomi delle colonne non
  -- si possono usare qui, si usa la posizione.
  order by 3 desc;
$$;

revoke all on function socio_storico(uuid) from public;
grant execute on function socio_storico(uuid) to authenticated;


-- ============================================================
-- 4. CONTROLLO
-- ============================================================

select 'soci in elenco' as cosa, count(*) as righe from soci_elenco();
