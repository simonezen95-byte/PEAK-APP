-- ============================================================
-- PEAK Functional Fitness — le comunicazioni della palestra
--
-- La tabella c'era già e la home del socio le mostra da tempo, ma non
-- c'era nessun modo di scriverne una: si poteva solo fare un insert a
-- mano nell'editor SQL, e nessuno veniva avvisato.
--
-- ------------------------------------------------------------
-- DUE PERMESSI, NON UNO
--
-- Esistono da sempre e finora non avevano una differenza vera:
--
--   com_board   "gestire la bacheca"     scrivere nell'app
--   com_send    "mandare comunicazioni"  far squillare i telefoni
--
-- Da qui in avanti ce l'hanno. Scrivere un avviso che resta nell'app
-- è una cosa; svegliare cinquanta telefoni di sera è un'altra, e non
-- è detto che chi può fare la prima debba poter fare la seconda.
--
-- Chi ha com_send può entrambe: mandare comprende scrivere.
--
-- ------------------------------------------------------------
-- NON SI MODIFICA, SI RIFÀ
--
-- Manca apposta una funzione per correggere una comunicazione già
-- pubblicata. Se è uscita sui telefoni, la frase che le persone hanno
-- letto è quella: cambiarla dopo lascerebbe in giro due versioni, una
-- sullo schermo bloccato e una nell'app, senza che nessuno sappia
-- quale vale. Si toglie e si riscrive.
--
-- Da eseguire dopo gli altri trentatré file.
-- ============================================================


-- ============================================================
-- 1. QUANTI SONO STATI AVVISATI
--
-- Si segna al momento della pubblicazione. Si potrebbe ricavare
-- contando le notifiche, ma quelle si cancellano col tempo e il
-- numero sparirebbe: qui invece resta.
-- ============================================================

alter table comunicazioni
  add column if not exists avvisati int not null default 0;

comment on column comunicazioni.avvisati is
  'Quanti soci hanno ricevuto la notifica quando è stata pubblicata. '
  'Zero vuol dire che è rimasta in bacheca.';


-- ============================================================
-- 2. PUBBLICARE
--
-- Torna l'identificativo della comunicazione. Chi la scrive non la
-- riceve: sa già cosa c'è scritto, l'ha scritta lui.
-- ============================================================

create or replace function pubblica_comunicazione(
  p_titolo text,
  p_testo  text,
  p_tipo   tipo_comunicazione default 'comunicazione',
  avvisa   boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  io      uuid := auth.uid();
  il_box  uuid := mio_box();
  nuova   uuid;
  quanti  int := 0;
begin
  if il_box is null or not (ho_permesso('com_board') or ho_permesso('com_send')) then
    raise exception 'Non puoi pubblicare comunicazioni.';
  end if;

  -- Il permesso in più serve solo per la parte in più.
  if avvisa and not ho_permesso('com_send') then
    raise exception 'Puoi scrivere in bacheca ma non mandare avvisi sul telefono.';
  end if;

  if length(trim(coalesce(p_titolo, ''))) = 0 then
    raise exception 'Serve un titolo.';
  end if;
  if length(trim(coalesce(p_testo, ''))) = 0 then
    raise exception 'Serve un testo.';
  end if;

  insert into comunicazioni (box_id, tipo, titolo, testo, autore_id)
  values (il_box, p_tipo, trim(p_titolo), trim(p_testo), io)
  returning id into nuova;

  if avvisa then
    -- Un solo comando per tutti: il database sveglia il speditore
    -- una volta sola, non una per socio.
    with scritte as (
      insert into notifiche (profilo_id, gruppo, titolo, testo)
      select p.id, 'comunicazione', trim(p_titolo), trim(p_testo)
      from profili p
      where p.box_id = il_box
        and p.stato = 'approvato'
        and p.id <> io
      returning 1
    )
    select count(*)::int into quanti from scritte;

    update comunicazioni set avvisati = quanti where id = nuova;
  end if;

  insert into attivita (box_id, autore_id, azione, oggetto_tipo, oggetto_id, dettaglio)
  values (il_box, io, 'comunicazione_pubblicata', 'comunicazione', nuova,
          jsonb_build_object('titolo', trim(p_titolo),
                             'tipo', p_tipo,
                             'avvisati', quanti));

  return nuova;
end;
$$;

revoke all on function pubblica_comunicazione(text, text, tipo_comunicazione, boolean) from public;
grant execute on function pubblica_comunicazione(text, text, tipo_comunicazione, boolean) to authenticated;


-- ============================================================
-- 3. TOGLIERE
--
-- Si scrive nel registro prima di cancellare: dopo, di cosa diceva
-- non resterebbe traccia da nessuna parte.
--
-- Le notifiche già partite non tornano indietro, e quelle già arrivate
-- sui telefoni nemmeno: si toglie dalla bacheca, non dalla memoria di
-- chi l'ha letta.
-- ============================================================

create or replace function togli_comunicazione(com uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c comunicazioni;
begin
  select * into c from comunicazioni where id = com;

  if c.id is null or c.box_id <> mio_box()
     or not (ho_permesso('com_board') or ho_permesso('com_send')) then
    raise exception 'Non puoi togliere questa comunicazione.';
  end if;

  insert into attivita (box_id, autore_id, azione, oggetto_tipo, oggetto_id, dettaglio)
  values (c.box_id, auth.uid(), 'comunicazione_tolta', 'comunicazione', c.id,
          jsonb_build_object('titolo', c.titolo,
                             'testo', c.testo,
                             'tipo', c.tipo,
                             'avvisati', c.avvisati,
                             'pubblicata_il', c.pubblicata_il));

  delete from comunicazioni where id = com;
end;
$$;

revoke all on function togli_comunicazione(uuid) from public;
grant execute on function togli_comunicazione(uuid) to authenticated;


-- ============================================================
-- 4. L'ELENCO PER LO STAFF
--
-- Quello che il socio vede lo legge già dalla tabella. Questo serve
-- alla console, e dice due cose in più: chi l'ha scritta e quanti
-- l'hanno ricevuta sul telefono.
-- ============================================================

create or replace function comunicazioni_elenco(quante int default 30)
returns table (
  id            uuid,
  tipo          text,
  titolo        text,
  testo         text,
  pubblicata_il timestamptz,
  autore        text,
  avvisati      int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.tipo::text, c.titolo, c.testo, c.pubblicata_il,
         coalesce(a.nome || ' ' || a.cognome, '—'),
         c.avvisati
  from comunicazioni c
  left join profili a on a.id = c.autore_id
  where c.box_id = mio_box()
    and (ho_permesso('com_board') or ho_permesso('com_send'))
  order by c.pubblicata_il desc
  limit greatest(1, least(coalesce(quante, 30), 200));
$$;

revoke all on function comunicazioni_elenco(int) from public;
grant execute on function comunicazioni_elenco(int) to authenticated;


-- ============================================================
-- 5. QUANTI NE RAGGIUNGEREI
--
-- Da mostrare accanto all'interruttore prima di pubblicare: "arriva
-- sul telefono di 23 soci su 47" è un'informazione che cambia la
-- decisione, "avvisa i soci" no.
-- ============================================================

create or replace function quanti_avviserei()
returns table (soci int, raggiungibili int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from profili p
      where p.box_id = mio_box() and p.stato = 'approvato' and p.id <> auth.uid()),
    (select count(distinct t.profilo_id)::int
       from push_telefoni t
       join profili p on p.id = t.profilo_id
      where p.box_id = mio_box() and p.stato = 'approvato'
        and p.id <> auth.uid() and t.errori < 5)
  where mio_box() is not null
    and (ho_permesso('com_board') or ho_permesso('com_send'));
$$;

revoke all on function quanti_avviserei() from public;
grant execute on function quanti_avviserei() to authenticated;


-- ============================================================
-- 6. CONTROLLO
-- ============================================================

select
  (select count(*) from comunicazioni)                      as in_bacheca,
  (select count(*) from push_gruppi
    where gruppo = 'comunicazione' and esce)                 as il_gruppo_esce,
  has_function_privilege('authenticated',
    'pubblica_comunicazione(text, text, tipo_comunicazione, boolean)', 'execute')
                                                             as lo_staff_puo_chiamarla;
