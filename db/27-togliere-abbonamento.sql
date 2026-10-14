-- ============================================================
-- PEAK Functional Fitness — togliere un abbonamento sbagliato
--
-- Finora un abbonamento si poteva solo registrare. Se lo si sbagliava
-- — pacchetto sbagliato, persona sbagliata, due volte lo stesso —
-- restava lì per sempre, e continuava a contare dappertutto: nel
-- valore del parco abbonamenti, nelle scadenze, nelle vendite per
-- pacchetto, nel grafico.
--
-- È saltato fuori subito: due persone registrate, quattro abbonamenti
-- addosso, rimasti dalle prove.
--
-- ------------------------------------------------------------
-- SI CANCELLA DAVVERO, E SI SCRIVE CHE L'HAI FATTO
--
-- Qui non si spegne come si fa coi pacchetti del listino: un
-- abbonamento sbagliato non è una cosa finita, è una cosa che non è
-- mai esistita, e deve sparire da tutti i conti. Se restasse marcato
-- "annullato" prima o poi qualche calcolo se ne dimenticherebbe.
--
-- Però prima di sparire lascia una riga nel registro attività, con
-- dentro cosa c'era scritto: chi, quale pacchetto, da quando a
-- quando, quanto valeva. Così cancellare non è un buco nero.
--
-- ATTENZIONE: serve a rimediare agli errori, non a chiudere in
-- anticipo l'abbonamento di chi smette. Quello è un fatto vero e deve
-- restare nella sua storia.
--
-- Da eseguire dopo gli altri ventisei file.
-- ============================================================

create or replace function togli_abbonamento(abb uuid, motivo text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a      abbonamenti;
  chi    profili;
  pacc   text;
  costo  numeric;
begin
  select * into a from abbonamenti where id = abb;
  if a.id is null then
    raise exception 'Questo abbonamento non esiste più.';
  end if;

  select * into chi from profili where id = a.profilo_id;

  if chi.box_id is null or chi.box_id <> mio_box()
     or not ho_permesso('abb_edit') then
    raise exception 'Non puoi togliere questo abbonamento.';
  end if;

  select k.nome, k.prezzo into pacc, costo
  from pacchetti k where k.id = a.pacchetto_id;

  -- Prima la riga nel registro, poi la cancellazione. In quest'ordine
  -- perché se la scrittura nel registro fallisse, l'abbonamento deve
  -- restare dov'è: meglio un errore che una cancellazione senza
  -- traccia.
  insert into attivita (box_id, autore_id, azione, oggetto_tipo, oggetto_id, dettaglio)
  values (
    chi.box_id, auth.uid(), 'abbonamento_tolto', 'abbonamento', abb,
    jsonb_build_object(
      'socio',      chi.cognome || ' ' || chi.nome,
      'socio_id',   chi.id,
      'pacchetto',  coalesce(pacc, '(pacchetto cancellato)'),
      'prezzo',     costo,
      'inizio',     a.inizio,
      'fine',       a.fine,
      'pagato',     a.pagato,
      'motivo',     motivo
    )
  );

  delete from abbonamenti where id = abb;
end;
$$;

revoke all on function togli_abbonamento(uuid, text) from public;
grant execute on function togli_abbonamento(uuid, text) to authenticated;


-- ============================================================
-- IL REGISTRO SI PUÒ LEGGERE
--
-- Un registro che nessuno può guardare non è un registro. Lo vede
-- chi ha il permesso sugli abbonamenti, dal proprio box soltanto.
-- ============================================================

drop function if exists registro_attivita(int);

create function registro_attivita(quante int default 50)
returns table (
  quando    timestamptz,
  autore    text,
  azione    text,
  dettaglio jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select t.creata_il,
         coalesce(p.cognome || ' ' || p.nome, '(non registrato)'),
         t.azione,
         t.dettaglio
  from attivita t
  left join profili p on p.id = t.autore_id
  where t.box_id = mio_box()
    and ho_permesso('abb_edit')
  order by t.creata_il desc
  limit greatest(1, least(coalesce(quante, 50), 500));
$$;

revoke all on function registro_attivita(int) from public;
grant execute on function registro_attivita(int) to authenticated;


-- ============================================================
-- CONTROLLO
-- ============================================================

select count(*) as righe_nel_registro from registro_attivita(50);
