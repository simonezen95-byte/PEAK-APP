-- ============================================================
-- PEAK Functional Fitness — le prenotazioni viste dal socio
--
-- Il palinsesto è lo schema settimanale fisso: "il lunedì alle
-- 18:30 c'è Functional". Le sessioni sono le lezioni vere, una
-- per ogni data. Finché una sessione non esiste, nessuno può
-- prenotarla.
--
-- Qui dentro due cose:
--   1. le sessioni nascono da sole quando qualcuno apre la
--      settimana, copiandole dal palinsesto;
--   2. una sola chiamata restituisce la settimana completa, già
--      con i posti occupati e con la tua prenotazione.
--
-- Da eseguire dopo gli altri quattro file.
-- ============================================================


-- ============================================================
-- 1. LE SESSIONI NASCONO DAL PALINSESTO
--
-- Crea le lezioni mancanti fra due date. Si può richiamare
-- all'infinito: quelle che ci sono già vengono saltate.
--
-- È "security definer" perché le sessioni le crea normalmente
-- solo lo staff, mentre qui serve che nascano anche quando è un
-- socio ad aprire il calendario. Il socio non guadagna nessun
-- potere: la funzione copia il palinsesto e basta.
-- ============================================================

create or replace function genera_sessioni(dal date, al date)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  box uuid;
begin
  if not sono_approvato() then return; end if;

  box := mio_box();
  if box is null then return; end if;

  -- Non più di tre mesi per volta: è una copia, non un calcolo,
  -- ma tanto vale non lasciarla sfuggire di mano.
  if al > dal + 92 then al := dal + 92; end if;
  if al < dal then return; end if;

  insert into sessioni (box_id, palinsesto_id, data, ora, durata_min,
                        tipo, nome, capienza, coach_id)
  select p.box_id, p.id, g.giorno::date, p.ora, p.durata_min,
         p.tipo, p.nome, p.capienza, p.coach_id
  from generate_series(dal, al, interval '1 day') as g(giorno)
  join palinsesto p
    on p.box_id = box
   and p.attivo
   and p.giorno = extract(dow from g.giorno)
  on conflict (box_id, data, ora, tipo) do nothing;
end;
$$;

revoke all on function genera_sessioni(date, date) from public;
grant execute on function genera_sessioni(date, date) to authenticated;


-- ============================================================
-- 2. LA SETTIMANA DEL SOCIO
--
-- Una sola chiamata per disegnare la schermata: per ogni lezione
-- dice quanti posti sono occupati, quanti sono in lista d'attesa,
-- se ci sei dentro tu e se puoi prenotarti.
--
-- Il conteggio degli iscritti passa di qui e non dal telefono
-- perché così resta un numero solo, senza scaricare la lista di
-- tutti i prenotati di tutta la settimana.
-- ============================================================

create or replace function settimana(dal date)
returns table (
  sessione_id    uuid,
  data           date,
  ora            time,
  durata_min     int,
  tipo           tipo_sessione,
  nome           text,
  capienza       int,
  coach          text,
  annullata      boolean,
  motivo_annullo text,
  iscritti       int,
  in_coda        int,
  mio_stato      text,
  mia_posizione  int,
  posso          boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  box uuid;
  al  date := dal + 6;
begin
  if not sono_approvato() then return; end if;

  box := mio_box();
  if box is null then return; end if;

  perform genera_sessioni(dal, al);

  return query
  select
    s.id,
    s.data,
    s.ora,
    s.durata_min,
    s.tipo,
    s.nome,
    s.capienza,
    nullif(trim(coalesce(c.nome, '') || ' ' || coalesce(c.cognome, '')), ''),
    s.annullata,
    s.motivo_annullo,
    coalesce(n.prenotati, 0)::int,
    coalesce(n.in_coda, 0)::int,
    mia.stato::text,
    mia.posizione_coda,
    -- Se sei già dentro la domanda non si pone.
    case when mia.id is not null then false
         else puo_prenotare(auth.uid(), s.id) end
  from sessioni s
  left join profili c on c.id = s.coach_id
  left join lateral (
    select
      count(*) filter (where p.stato = 'prenotato'
                          or p.stato = 'presente') as prenotati,
      count(*) filter (where p.stato = 'lista_attesa') as in_coda
    from prenotazioni p
    where p.sessione_id = s.id
  ) n on true
  left join prenotazioni mia
    on mia.sessione_id = s.id
   and mia.profilo_id = auth.uid()
   and mia.stato in ('prenotato', 'lista_attesa', 'presente')
  where s.box_id = box
    and s.data between dal and al
  order by s.data, s.ora, s.tipo;
end;
$$;

revoke all on function settimana(date) from public;
grant execute on function settimana(date) to authenticated;


-- ============================================================
-- 3. PERCHÉ NON POSSO PRENOTARE
--
-- Dire soltanto "non puoi" fa tornare il socio in reception a
-- chiedere perché. Questa funzione dà le tre date che contano,
-- e l'app ne ricava la frase giusta.
-- ============================================================

create or replace function mio_accesso()
returns table (
  certificato_scadenza date,
  quota_fino           date,
  abbonamento          text,
  abbonamento_fine     date,
  residui              int,
  include_classi       boolean
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
    a.residui,
    k.include_classi
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
-- 4. QUANDO SI FA ANCORA IN TEMPO A DISDIRE
--
-- Fino a 15 minuti prima dell'inizio. Dopo, il socio deve avvisare
-- lo staff, che può sempre intervenire.
--
-- La regola sta qui e non nell'app: un bottone spento si riaccende
-- con poco mestiere, una regola del database no.
-- ============================================================

drop policy if exists "ognuno disdice le proprie prenotazioni" on prenotazioni;

create policy "ognuno disdice le proprie prenotazioni"
  on prenotazioni for update to authenticated
  using (
    profilo_id = auth.uid()
    and exists (
      select 1 from sessioni s
      where s.id = sessione_id
        and (s.data + s.ora) > now() + interval '15 minutes'
    )
  );

-- Cancellare la riga invece di disdirla farebbe sparire la
-- prenotazione dallo storico e, soprattutto, salterebbe il passaggio
-- del posto a chi è primo in lista d'attesa. Il socio quindi disdice
-- e basta; a cancellare resta solo lo staff.
drop policy if exists "ognuno cancella le proprie prenotazioni" on prenotazioni;


-- ============================================================
-- 5. CONTROLLO
-- ============================================================

select 'sessioni create' as cosa, count(*) as righe
from sessioni;
