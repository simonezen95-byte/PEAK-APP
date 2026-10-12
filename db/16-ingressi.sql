-- ============================================================
-- PEAK Functional Fitness — gli ingressi
--
-- Una presenza consuma un ingresso, ma quanti ingressi si abbiano
-- dipende dal pacchetto. Quattro forme, tutte previste:
--
--   1. ILLIMITATO        ingressi vuoto, nessun tetto a settimana.
--                        Mensile libero, Trimestrale, Semestrale,
--                        Annuale. Non si scala niente.
--
--   2. A INGRESSI        ingressi = 8 o 12. Un pacchetto che finisce:
--                        quando sono finiti, finiti.
--
--   3. A SETTIMANA       lezioni_settimana = 2. Due a settimana vuol
--      (colonna nuova)   dire due: si azzera ogni lunedì, e quelle non
--                        usate non si mettono da parte.
--
--   4. SOLO OPEN BOX     include_classi = falso. Le classi non le apre.
--
-- ------------------------------------------------------------
-- COME SI CONTANO: non si scala, si conta.
--
-- La strada ovvia sarebbe togliere uno dal contatore a ogni presenza
-- confermata. Il guaio è che le presenze si correggono — una classe si
-- può riaprire e rispuntare — e un contatore scalato a mano, dopo due
-- correzioni, non torna più. Senza che nessuno se ne accorga.
--
-- Qui il contatore non esiste: gli ingressi usati si contano ogni
-- volta dalle prenotazioni. Una correzione si sistema da sola, perché
-- non c'è niente da sistemare.
--
-- Cosa consuma un ingresso:
--   · una presenza confermata dal coach                → sì
--   · una prenotazione per una classe futura           → sì, tiene il
--     posto: con un ingresso solo non se ne prenotano cinque
--   · chi non si è presentato (assente)                → no, per ora:
--     cosa fare dei no-show è ancora da decidere
--   · lista d'attesa, disdette, lezioni annullate      → no
--   · l'Open Box                                       → no, gli
--     ingressi sono quelli delle classi
--
-- Da eseguire dopo gli altri quindici file.
-- ============================================================


-- ============================================================
-- 1. IL TETTO SETTIMANALE
-- ============================================================

alter table pacchetti
  add column if not exists lezioni_settimana int;

comment on column pacchetti.lezioni_settimana is
  'Quante classi a settimana apre questo pacchetto. Vuoto = nessun '
  'tetto settimanale. Si azzera ogni lunedì: quelle non usate non si '
  'accumulano.';


-- ============================================================
-- 2. QUANTI NE HO USATI
-- ============================================================

/** Gli ingressi consumati da un abbonamento, contati dalle
    prenotazioni. Vedi la nota in cima su cosa conta e cosa no. */
create or replace function ingressi_usati(abb uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from abbonamenti a
  join prenotazioni p on p.profilo_id = a.profilo_id
  join sessioni s on s.id = p.sessione_id
  where a.id = abb
    and s.tipo = 'classe'
    and not s.annullata
    and s.data between a.inizio and a.fine
    and p.stato in ('prenotato', 'presente');
$$;

/** Quanti ne restano. Vuoto se il pacchetto è illimitato: lì non c'è
    un numero da mostrare, e uno zero sarebbe una bugia. */
create or replace function ingressi_residui(abb uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when a.totali is null then null
    else greatest(0, a.totali - ingressi_usati(a.id))
  end
  from abbonamenti a where a.id = abb;
$$;

/** Le classi di una settimana, per il tetto settimanale. La settimana
    è quella in cui cade la lezione, non quella di oggi. */
create or replace function lezioni_in_settimana(socio uuid, giorno date)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where p.profilo_id = socio
    and s.tipo = 'classe'
    and not s.annullata
    and s.data >= date_trunc('week', giorno)::date
    and s.data <  date_trunc('week', giorno)::date + 7
    and p.stato in ('prenotato', 'presente');
$$;

revoke all on function ingressi_usati(uuid) from public;
revoke all on function ingressi_residui(uuid) from public;
revoke all on function lezioni_in_settimana(uuid, date) from public;
grant execute on function ingressi_usati(uuid) to authenticated;
grant execute on function ingressi_residui(uuid) to authenticated;
grant execute on function lezioni_in_settimana(uuid, date) to authenticated;


-- ============================================================
-- 3. CHI PUÒ PRENOTARE — adesso guarda anche i due tetti
-- ============================================================

create or replace function puo_prenotare(socio uuid, sess uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p        profili;
  s        sessioni;
  a        abbonamenti;
  k        pacchetti;
  quota_ok boolean;
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

  -- L'abbonamento valido il giorno della classe.
  select * into a
  from abbonamenti x
  where x.profilo_id = socio
    and x.tipo = 'abbonamento'
    and x.pagato
    and s.data between x.inizio and x.fine
  order by x.fine desc
  limit 1;

  if a.id is null then return false; end if;

  select * into k from pacchetti where id = a.pacchetto_id;

  -- Un pacchetto che non apre le classi apre solo l'Open Box.
  if s.tipo = 'classe' and not k.include_classi then return false; end if;

  -- L'Open Box non consuma ingressi: chi è in regola entra.
  if s.tipo <> 'classe' then return true; end if;

  -- Tetto totale del pacchetto.
  if a.totali is not null and ingressi_usati(a.id) >= a.totali then
    return false;
  end if;

  -- Tetto della settimana in cui cade la lezione.
  if k.lezioni_settimana is not null
     and lezioni_in_settimana(socio, s.data) >= k.lezioni_settimana then
    return false;
  end if;

  return true;
end;
$$;


-- ============================================================
-- 3bis. LA LISTA D'ATTESA NON SCAVALCA IL TETTO
--
-- Stare in coda non consuma un ingresso: non hai un posto. Ma quando
-- si libera e tu entri, quell'ingresso lo consumi — e in quel momento
-- il tetto potrebbe essere già pieno.
--
-- Succede così: Marco ha due lezioni a settimana. Si mette in coda a
-- una classe piena (zero ingressi consumati), poi ne prenota altre
-- due (due consumati, è al suo tetto). Qualcuno disdice la prima,
-- Marco entra, e si ritrova a tre.
--
-- Quindi il posto che si libera va al primo della coda che può
-- davvero prenderlo. Gli altri restano in coda al loro posto: non è
-- una bocciatura, è che quella settimana è già piena.
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
    from prenotazioni p
    where p.sessione_id = new.sessione_id
      and p.stato = 'lista_attesa'
      and puo_prenotare(p.profilo_id, p.sessione_id)
    order by p.posizione_coda
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
-- 4. COSA VEDE IL SOCIO
--
-- Gli ingressi residui non arrivano più dalla colonna: si contano.
-- In più arrivano i due numeri della settimana, che servono all'app
-- per dire "hai già fatto le tue due" invece di un "non puoi" secco.
-- ============================================================

drop function if exists mio_accesso();

create function mio_accesso()
returns table (
  certificato_scadenza date,
  quota_fino           date,
  abbonamento          text,
  abbonamento_fine     date,
  residui              int,
  include_classi       boolean,
  lezioni_settimana    int,
  fatte_in_settimana   int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.certificato_scadenza,
    (select max(make_date(q.anno_sportivo, 8, 31))
       from quote q where q.profilo_id = p.id),
    k.nome,
    a.fine,
    ingressi_residui(a.id),
    k.include_classi,
    k.lezioni_settimana,
    case when k.lezioni_settimana is null then null
         else lezioni_in_settimana(p.id, current_date) end
  from profili p
  left join lateral (
    select * from abbonamenti a
    where a.profilo_id = p.id
      and a.tipo = 'abbonamento'
      and a.pagato
      and current_date between a.inizio and a.fine
    order by a.fine desc
    limit 1
  ) a on true
  left join pacchetti k on k.id = a.pacchetto_id
  where p.id = auth.uid();
$$;

revoke all on function mio_accesso() from public;
grant execute on function mio_accesso() to authenticated;


-- ============================================================
-- 5. COSA VEDE LA RECEPTION
-- ============================================================

drop function if exists soci_elenco(text);

create function soci_elenco(cerca text default '')
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
    (select max(make_date(q.anno_sportivo, 8, 31))
       from quote q where q.profilo_id = p.id),
    k.nome,
    a.fine,
    ingressi_residui(a.id),
    p.stato = 'approvato'
      and p.certificato_scadenza >= current_date
      and exists (select 1 from quote q
                   where q.profilo_id = p.id
                     and make_date(q.anno_sportivo, 8, 31) >= current_date)
      and a.id is not null
      and coalesce(ingressi_residui(a.id), 1) > 0
  from profili p
  left join lateral (
    select * from abbonamenti x
    where x.profilo_id = p.id
      and x.tipo = 'abbonamento'
      and x.pagato
      and current_date between x.inizio and x.fine
    order by x.fine desc
    limit 1
  ) a on true
  left join pacchetti k on k.id = a.pacchetto_id
  where p.box_id = mio_box()
    and ho_permesso('soci_view')
    and (
      coalesce(cerca, '') = ''
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


/** Lo storico di un socio: anche qui gli ingressi si contano. */
drop function if exists socio_storico(uuid);

create function socio_storico(socio uuid)
returns table (
  genere   text,
  nome     text,
  dal      date,
  al       date,
  residui  int,
  totali   int
)
language sql
stable
security definer
set search_path = public
as $$
  select 'abbonamento', k.nome, a.inizio, a.fine,
         ingressi_residui(a.id), a.totali
  from abbonamenti a
  join pacchetti k on k.id = a.pacchetto_id
  where a.profilo_id = socio and ho_permesso('abb_view')
  union all
  select 'quota',
         'Quota ' || q.anno_sportivo || '/' || (q.anno_sportivo + 1),
         q.versata_il, make_date(q.anno_sportivo, 8, 31), null, null
  from quote q
  where q.profilo_id = socio and ho_permesso('abb_view')
  -- Per numero d'ordine: una UNION non sa ordinare per nome di colonna.
  order by 3 desc;
$$;

revoke all on function socio_storico(uuid) from public;
grant execute on function socio_storico(uuid) to authenticated;


-- ============================================================
-- 6. I SOCI IN REGOLA SUL CRUSCOTTO — stessa misura
-- ============================================================

create or replace function cruscotto()
returns table (
  soci_in_regola int,
  da_approvare   int,
  nuovi_del_mese int,
  classi_oggi    int,
  posti_oggi     int,
  prenotati_oggi int,
  openbox_oggi   int
)
language sql
stable
security definer
set search_path = public
as $$
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
                       and coalesce(ingressi_residui(a.id), 1) > 0)),
    (select count(*)::int from profili
      where box_id = mio_box() and stato = 'in_attesa'),
    (select count(*)::int from profili
      where box_id = mio_box()
        and iscritto_il >= date_trunc('month', current_date)),
    (select count(*)::int from sessioni
      where box_id = mio_box() and data = current_date
        and tipo = 'classe' and not annullata),
    (select coalesce(sum(capienza), 0)::int from sessioni
      where box_id = mio_box() and data = current_date
        and tipo = 'classe' and not annullata),
    (select count(*)::int from prenotazioni p
      join sessioni s on s.id = p.sessione_id
      where s.box_id = mio_box() and s.data = current_date
        and s.tipo = 'classe'
        and p.stato in ('prenotato', 'presente')),
    (select count(*)::int from prenotazioni p
      join sessioni s on s.id = p.sessione_id
      where s.box_id = mio_box() and s.data = current_date
        and s.tipo = 'openbox'
        and p.stato in ('prenotato', 'presente'))
  where ho_permesso('soci_view');
$$;

revoke all on function cruscotto() from public;
grant execute on function cruscotto() to authenticated;


-- ============================================================
-- 7. UN PACCHETTO A DUE LEZIONI A SETTIMANA
--
-- Prezzo da decidere: 55 € è un segnaposto, sta fra il Mensile 8 e il
-- Mensile libero. Da sistemare quando si fissano i prezzi veri.
-- ============================================================

insert into pacchetti (box_id, tipo, nome, prezzo, mesi, lezioni_settimana, include_classi)
select id, 'abbonamento', 'Mensile 2 a settimana', 55.00, 1, 2, true
from boxes
where not exists (
  select 1 from pacchetti where nome = 'Mensile 2 a settimana'
);


-- ============================================================
-- 8. CONTROLLO
-- ============================================================

select nome, prezzo, ingressi, lezioni_settimana, include_classi
from pacchetti
where tipo = 'abbonamento'
order by prezzo;
