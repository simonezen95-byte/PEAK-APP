-- ============================================================
-- PEAK Functional Fitness — gestire una classe
--
-- Annullare una lezione, cambiare la capienza, assegnare il coach.
-- Fin qui si potevano fare solo da SQL: cose che a palestra aperta
-- capitano tutte le settimane, e che non devono passare da qui.
--
-- Il pezzo che mancava davvero però non è il bottone: è l'avviso. Il
-- campo "annullata" lo legge mezzo database, ma nessuno lo scriveva e
-- nessuno avvisava chi era prenotato. Una lezione annullata senza
-- avviso vuol dire soci che si presentano davanti a una porta chiusa.
--
-- Da eseguire dopo gli altri sedici file.
-- ============================================================


-- ============================================================
-- 1. LA CODA NON ENTRA IN UNA CLASSE ANNULLATA
--
-- Annullare vuol dire disdire tutte le prenotazioni, e ogni disdetta
-- fa scattare la promozione dalla coda. Senza questa riga il primo in
-- lista d'attesa riceverebbe "sei entrato in classe" per una lezione
-- che non si terrà.
-- ============================================================

create or replace function promuove_dalla_coda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primo prenotazioni;
  s     sessioni;
begin
  if old.stato = 'prenotato' and new.stato = 'disdetta' then
    select * into s from sessioni where id = new.sessione_id;

    -- Niente promozioni a cose fatte, né in una lezione annullata.
    if s.annullata or inizio_sessione(s.data, s.ora) <= now() then
      return new;
    end if;

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
-- 2. ANNULLARE
--
-- Tre cose insieme, e in quest'ordine: si segna la lezione annullata,
-- si disdicono le prenotazioni, si avvisa chi c'era dentro. L'ordine
-- conta: prima il segno, perché è quello che impedisce alla coda di
-- entrare mentre si disdice.
--
-- Chi era in lista d'attesa viene avvisato come gli altri: aspettava
-- una lezione che non ci sarà.
-- ============================================================

create or replace function annulla_classe(sess uuid, motivo text default null)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s       sessioni;
  avvisati int;
  quando  text;
begin
  select * into s from sessioni where id = sess;

  if s.id is null or s.box_id <> mio_box() or not ho_permesso('cl_edit') then
    raise exception 'Non puoi annullare questa lezione.';
  end if;

  if s.annullata then
    raise exception 'Questa lezione è già annullata.';
  end if;

  update sessioni
  set annullata = true,
      motivo_annullo = nullif(trim(coalesce(motivo, '')), '')
  where id = sess;

  update prenotazioni
  set stato = 'disdetta', disdetta_il = now()
  where sessione_id = sess
    and stato in ('prenotato', 'lista_attesa');

  -- "venerdì 16 ottobre alle 18:00"
  quando := to_char(s.data, 'DD/MM') || ' alle ' || to_char(s.ora, 'HH24:MI');

  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select p.profilo_id, 'classe_annullata',
         'Lezione annullata',
         s.nome || ' del ' || quando || ' non si terrà.'
           || coalesce(' ' || nullif(trim(coalesce(motivo, '')), ''), '')
           || ' La tua prenotazione è stata annullata.'
  from prenotazioni p
  where p.sessione_id = sess
    and p.stato = 'disdetta'
    and p.disdetta_il >= now() - interval '1 minute';

  get diagnostics avvisati = row_count;
  return avvisati;
end;
$$;

revoke all on function annulla_classe(uuid, text) from public;
grant execute on function annulla_classe(uuid, text) to authenticated;


/* Rimettere in piedi una lezione annullata per sbaglio.

   Le prenotazioni NON tornano indietro: chi era iscritto ha ricevuto
   l'avviso che non si teneva e nel frattempo si sarà organizzato
   altrimenti. Rimetterlo dentro a sua insaputa sarebbe peggio del
   problema. La lezione riapre vuota e si avvisa chi c'era, così
   decide lui. */
create or replace function riapri_classe(sess uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s        sessioni;
  avvisati int;
  quando   text;
begin
  select * into s from sessioni where id = sess;

  if s.id is null or s.box_id <> mio_box() or not ho_permesso('cl_edit') then
    raise exception 'Non puoi riaprire questa lezione.';
  end if;

  if not s.annullata then
    raise exception 'Questa lezione non è annullata.';
  end if;

  update sessioni set annullata = false, motivo_annullo = null where id = sess;

  quando := to_char(s.data, 'DD/MM') || ' alle ' || to_char(s.ora, 'HH24:MI');

  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select distinct p.profilo_id, 'classe_annullata',
         'Lezione di nuovo in programma',
         s.nome || ' del ' || quando || ' si terrà regolarmente. '
           || 'Se vuoi esserci, prenota di nuovo: il posto non è più tuo.'
  from prenotazioni p
  where p.sessione_id = sess and p.stato = 'disdetta';

  get diagnostics avvisati = row_count;
  return avvisati;
end;
$$;

revoke all on function riapri_classe(uuid) from public;
grant execute on function riapri_classe(uuid) to authenticated;


-- ============================================================
-- 3. CAMBIARE LA CAPIENZA
--
-- In su: si fanno entrare quelli in coda che possono, uno per volta,
-- fino a riempire i posti nuovi.
--
-- In giù sotto il numero dei prenotati: no. Vorrebbe dire buttare
-- fuori qualcuno, e chi buttare fuori non lo decide un programma.
-- Se serve davvero, si toglie a mano dalla classe e poi si stringe.
-- ============================================================

create or replace function cambia_capienza(sess uuid, nuova int)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s        sessioni;
  dentro   int;
  primo    prenotazioni;
  entrati  int := 0;
begin
  select * into s from sessioni where id = sess;

  if s.id is null or s.box_id <> mio_box() or not ho_permesso('cl_edit') then
    raise exception 'Non puoi modificare questa lezione.';
  end if;

  if nuova < 1 then
    raise exception 'La capienza dev''essere almeno 1.';
  end if;

  select count(*) into dentro
  from prenotazioni
  where sessione_id = sess and stato in ('prenotato', 'presente');

  if nuova < dentro then
    raise exception
      'Ci sono già % iscritti: togline qualcuno prima di stringere a %.',
      dentro, nuova;
  end if;

  update sessioni set capienza = nuova where id = sess;

  -- Posti nuovi: entra chi è in coda e può davvero entrare.
  while entrati < nuova - dentro loop
    select * into primo
    from prenotazioni p
    where p.sessione_id = sess
      and p.stato = 'lista_attesa'
      and puo_prenotare(p.profilo_id, p.sessione_id)
    order by p.posizione_coda
    limit 1;

    exit when primo.id is null;

    update prenotazioni
    set stato = 'prenotato', posizione_coda = null
    where id = primo.id;

    insert into notifiche (profilo_id, gruppo, titolo, testo)
    values (primo.profilo_id, 'lista_attesa',
            'Sei entrato in classe',
            'Si è liberato un posto: la tua prenotazione è confermata.');

    entrati := entrati + 1;
  end loop;

  return entrati;
end;
$$;

revoke all on function cambia_capienza(uuid, int) from public;
grant execute on function cambia_capienza(uuid, int) to authenticated;


-- ============================================================
-- 4. ASSEGNARE IL COACH
--
-- Dev'essere uno dello staff di questa palestra. Senza il controllo
-- si potrebbe mettere coach un socio qualsiasi, e quel socio si
-- troverebbe a dover confermare le presenze di una classe.
-- ============================================================

create or replace function assegna_coach(sess uuid, coach uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s sessioni;
  c profili;
begin
  select * into s from sessioni where id = sess;

  if s.id is null or s.box_id <> mio_box() or not ho_permesso('cl_edit') then
    raise exception 'Non puoi modificare questa lezione.';
  end if;

  if coach is null then
    update sessioni set coach_id = null where id = sess;
    return;
  end if;

  select * into c from profili where id = coach;

  if c.id is null
     or c.box_id <> s.box_id
     or c.stato <> 'approvato'
     or c.ruolo not in ('coach', 'admin', 'owner') then
    raise exception 'Questa persona non è nello staff della palestra.';
  end if;

  update sessioni set coach_id = coach where id = sess;
end;
$$;

revoke all on function assegna_coach(uuid, uuid) from public;
grant execute on function assegna_coach(uuid, uuid) to authenticated;


/** Chi si può mettere come coach: lo staff approvato di questa
    palestra. Serve alla tendina nell'app. */
create or replace function elenco_coach()
returns table (id uuid, nome text, cognome text, ruolo ruolo_profilo)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome, p.cognome, p.ruolo
  from profili p
  where p.box_id = mio_box()
    and p.stato = 'approvato'
    and p.ruolo in ('coach', 'admin', 'owner')
    and ho_permesso('cl_view')
  order by p.cognome, p.nome;
$$;

revoke all on function elenco_coach() from public;
grant execute on function elenco_coach() to authenticated;


-- ============================================================
-- 5. UNA LEZIONE IN PIÙ, FUORI PALINSESTO
--
-- Il seminario del sabato, la classe aggiunta sotto Natale: roba che
-- non sta nel modello settimanale e che non deve farci mettere mano.
-- ============================================================

create or replace function aggiungi_lezione(
  giorno    date,
  ora       time,
  nome      text default 'Functional',
  capienza  int  default 15,
  durata    int  default 60,
  tipo      tipo_sessione default 'classe',
  coach     uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  nuova uuid;
begin
  if not ho_permesso('cl_edit') then
    raise exception 'Non puoi aggiungere lezioni.';
  end if;

  if inizio_sessione(giorno, ora) < now() then
    raise exception 'Non si aggiunge una lezione nel passato.';
  end if;

  insert into sessioni (box_id, data, ora, durata_min, tipo, nome, capienza, coach_id)
  values (mio_box(), giorno, ora, greatest(10, durata), tipo,
          coalesce(nullif(trim(nome), ''), 'Functional'),
          greatest(1, capienza), coach)
  returning id into nuova;

  return nuova;
exception
  when unique_violation then
    raise exception 'C''è già una lezione di questo tipo a quell''ora.';
end;
$$;

revoke all on function aggiungi_lezione(date, time, text, int, int, tipo_sessione, uuid) from public;
grant execute on function aggiungi_lezione(date, time, text, int, int, tipo_sessione, uuid) to authenticated;


-- ============================================================
-- 6. CONTROLLO
-- ============================================================

select 'coach disponibili' as cosa, count(*) as quanti from elenco_coach();
