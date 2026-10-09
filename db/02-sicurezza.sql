-- ============================================================
-- PEAK Functional Fitness — regole di sicurezza
--
-- Nascondere un pulsante nell'app non basta: chiunque può
-- chiamare il database direttamente. Queste regole stanno sul
-- server e valgono comunque, anche se l'app venisse aggirata.
--
-- Il principio: ogni archivio è chiuso a chiave. Qui sotto si
-- aprono le singole porte, una per volta, dicendo chi passa.
--
-- Da eseguire dopo 01-schema.sql.
-- ============================================================


-- ============================================================
-- A. CHI SEI
-- Funzioni che rispondono alle domande "di che palestra sei",
-- "che ruolo hai", "hai questo permesso".
--
-- Sono "security definer": leggono la tua scheda scavalcando le
-- regole. Serve, altrimenti la regola che protegge le schede
-- chiamerebbe se stessa all'infinito.
-- ============================================================

create or replace function mio_profilo()
returns profili
language sql
stable
security definer
set search_path = public
as $$
  select * from profili where id = auth.uid();
$$;

create or replace function mio_box()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select box_id from profili where id = auth.uid();
$$;

create or replace function sono_approvato()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select stato = 'approvato' from profili where id = auth.uid()), false);
$$;

create or replace function sono_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select stato = 'approvato' and ruolo in ('coach','admin','owner')
    from profili where id = auth.uid()
  ), false);
$$;

create or replace function sono_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ruolo = 'owner' from profili where id = auth.uid()), false);
$$;

-- Il ruolo riempie le caselle di default; l'owner può spuntarne
-- altre sulla singola scheda, e quelle vincono.
create or replace function ho_permesso(chiave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null or p.stato <> 'approvato' then false
    when p.ruolo = 'owner' then true
    when p.permessi ? chiave then (p.permessi->>chiave)::boolean
    when p.ruolo = 'admin' then true
    when p.ruolo = 'coach' then chiave in ('soci_view','cl_view','cl_attendance')
    else false
  end
  from (select * from profili where id = auth.uid()) p;
$$;


-- ============================================================
-- B. LE PORTE
-- Il progetto è stato creato senza aprire in automatico gli
-- archivi nuovi: vanno aperti qui, e poi ogni archivio resta
-- comunque protetto dalle regole della sezione D.
-- ============================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table boxes          enable row level security;
alter table profili        enable row level security;
alter table consensi       enable row level security;
alter table pacchetti      enable row level security;
alter table abbonamenti    enable row level security;
alter table quote          enable row level security;
alter table palinsesto     enable row level security;
alter table sessioni       enable row level security;
alter table prenotazioni   enable row level security;
alter table wod            enable row level security;
alter table wod_varianti   enable row level security;
alter table wod_score      enable row level security;
alter table esercizi       enable row level security;
alter table pr             enable row level security;
alter table comunicazioni  enable row level security;
alter table notifiche      enable row level security;
alter table attivita       enable row level security;


-- ============================================================
-- C. CHI PUÒ PRENOTARE
-- Un posto solo dove sta la regola, così l'app e il database
-- rispondono sempre la stessa cosa.
--
-- Il controllo è sulla data della classe, non su oggi: se
-- l'abbonamento scade fra due giorni si prenota fino a lì.
-- ============================================================

create or replace function puo_prenotare(socio uuid, sess uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p profili;
  s sessioni;
  quota_ok boolean;
  abb_ok boolean;
begin
  select * into p from profili where id = socio;
  select * into s from sessioni where id = sess;

  if p.id is null or s.id is null then return false; end if;
  if p.stato <> 'approvato' then return false; end if;
  if p.box_id <> s.box_id then return false; end if;
  if s.annullata then return false; end if;

  -- Non si prenota nel passato.
  if (s.data + s.ora) < now() then return false; end if;

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

  -- Abbonamento valido il giorno della classe, pagato, con
  -- ingressi residui, e che apra le classi se è una classe.
  select exists (
    select 1
    from abbonamenti a
    join pacchetti k on k.id = a.pacchetto_id
    where a.profilo_id = socio
      and a.tipo = 'abbonamento'
      and a.pagato
      and s.data between a.inizio and a.fine
      and (a.residui is null or a.residui > 0)
      and (s.tipo = 'openbox' or k.include_classi)
  ) into abb_ok;

  return abb_ok;
end;
$$;


-- ============================================================
-- D. CHI PUÒ FARE COSA
-- ============================================================

-- ---------- La palestra ----------

create policy "soci leggono la propria palestra"
  on boxes for select to authenticated
  using (id = mio_box());

create policy "solo l'owner modifica la palestra"
  on boxes for update to authenticated
  using (id = mio_box() and sono_owner());


-- ---------- Le schede delle persone ----------
-- La scheda completa (telefono, data di nascita, scadenza del
-- certificato) la vede solo l'interessato e lo staff. Gli altri
-- soci vedono solo nome e foto, attraverso la vista più sotto.

create policy "ognuno vede la propria scheda"
  on profili for select to authenticated
  using (id = auth.uid());

create policy "lo staff vede le schede del proprio box"
  on profili for select to authenticated
  using (box_id = mio_box() and ho_permesso('soci_view'));

-- In registrazione il socio crea la propria scheda. Non può
-- nominarsi admin né approvarsi da solo.
create policy "ci si registra da soli"
  on profili for insert to authenticated
  with check (
    id = auth.uid()
    and stato = 'in_attesa'
    and ruolo = 'socio'
    and permessi = '{}'::jsonb
  );

create policy "ognuno aggiorna la propria scheda"
  on profili for update to authenticated
  using (id = auth.uid());

create policy "lo staff aggiorna le schede del proprio box"
  on profili for update to authenticated
  using (box_id = mio_box() and (ho_permesso('soci_edit') or ho_permesso('soci_approve')));

create policy "solo l'owner elimina un account"
  on profili for delete to authenticated
  using (box_id = mio_box() and sono_owner());


-- Quali campi può toccare il socio sulla propria scheda.
-- Le regole qui sopra dicono "su quali righe"; questo dice
-- "su quali colonne", che le regole da sole non sanno fare.
create or replace function protegge_campi_profilo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chi_sono uuid := auth.uid();
begin
  -- Chiamata dal server (nessun utente collegato): passa.
  if chi_sono is null then
    return new;
  end if;

  -- Ruolo e permessi: solo l'owner, e non può declassare se stesso.
  if (new.ruolo is distinct from old.ruolo
      or new.permessi is distinct from old.permessi) then
    if not sono_owner() then
      raise exception 'Solo il titolare può assegnare ruoli e permessi.';
    end if;
    if old.ruolo = 'owner' and old.id = chi_sono then
      raise exception 'Il titolare non può togliersi il proprio ruolo.';
    end if;
  end if;

  -- Il socio su se stesso: può cambiare solo email, telefono,
  -- foto, privacy e notifiche. Il resto lo tocca lo staff, dopo
  -- aver visto un documento.
  if new.id = chi_sono and not ho_permesso('soci_edit') then
    if new.nome is distinct from old.nome
       or new.cognome is distinct from old.cognome
       or new.data_nascita is distinct from old.data_nascita
       or new.box_id is distinct from old.box_id
       or new.stato is distinct from old.stato
       or new.certificato_scadenza is distinct from old.certificato_scadenza then
      raise exception 'Questi dati li aggiorna lo staff in reception.';
    end if;
  end if;

  -- Cambio email fatto dal socio: resta segnalato finché lo staff
  -- non lo verifica.
  if new.email is distinct from old.email and new.id = chi_sono and not sono_staff() then
    new.email_cambiata_il := now();
    new.email_verificata_il := null;
  end if;

  return new;
end;
$$;

create trigger protegge_campi_profilo
  before update on profili
  for each row execute function protegge_campi_profilo();


-- Quello che i soci vedono l'uno dell'altro: nient'altro.
-- Serve per la lista iscritti a una classe, che è pubblica.
create view soci_pubblici as
  select id, box_id, nome, cognome, foto_url
  from profili
  where stato = 'approvato' and box_id = mio_box();

comment on view soci_pubblici is
  'Scheda ridotta visibile a tutti i soci del box: solo nome e foto.
   La vista scavalca di proposito le regole su profili, perché
   espone unicamente colonne non sensibili ed è già filtrata sul box.';

grant select on soci_pubblici to authenticated;


-- ---------- Consensi privacy ----------

create policy "ognuno vede i propri consensi"
  on consensi for select to authenticated
  using (profilo_id = auth.uid() or ho_permesso('soci_view'));

create policy "ognuno registra i propri consensi"
  on consensi for insert to authenticated
  with check (profilo_id = auth.uid());


-- ---------- Catalogo pacchetti ----------

create policy "tutti vedono il catalogo del proprio box"
  on pacchetti for select to authenticated
  using (box_id = mio_box() and sono_approvato());

create policy "il catalogo lo gestisce chi tiene gli abbonamenti"
  on pacchetti for all to authenticated
  using (box_id = mio_box() and ho_permesso('abb_edit'))
  with check (box_id = mio_box() and ho_permesso('abb_edit'));


-- ---------- Abbonamenti e quote ----------

create policy "ognuno vede i propri abbonamenti"
  on abbonamenti for select to authenticated
  using (profilo_id = auth.uid() or ho_permesso('abb_view'));

create policy "i rinnovi li registra lo staff"
  on abbonamenti for all to authenticated
  using (ho_permesso('abb_edit'))
  with check (ho_permesso('abb_edit'));

create policy "ognuno vede le proprie quote"
  on quote for select to authenticated
  using (profilo_id = auth.uid() or ho_permesso('abb_view'));

create policy "le quote le registra lo staff"
  on quote for all to authenticated
  using (ho_permesso('abb_edit'))
  with check (ho_permesso('abb_edit'));


-- ---------- Palinsesto e sessioni ----------

create policy "tutti vedono il palinsesto"
  on palinsesto for select to authenticated
  using (box_id = mio_box() and sono_approvato());

create policy "il palinsesto lo modifica chi ne ha il permesso"
  on palinsesto for all to authenticated
  using (box_id = mio_box() and ho_permesso('cl_edit'))
  with check (box_id = mio_box() and ho_permesso('cl_edit'));

create policy "tutti vedono le sessioni"
  on sessioni for select to authenticated
  using (box_id = mio_box() and sono_approvato());

create policy "le sessioni le modifica chi ne ha il permesso"
  on sessioni for all to authenticated
  using (box_id = mio_box() and ho_permesso('cl_edit'))
  with check (box_id = mio_box() and ho_permesso('cl_edit'));

-- Il coach conferma le presenze solo delle classi che tiene lui.
create policy "il coach chiude le proprie classi"
  on sessioni for update to authenticated
  using (
    box_id = mio_box()
    and ho_permesso('cl_attendance')
    and (coach_id = auth.uid() or ho_permesso('cl_edit'))
  );


-- ---------- Prenotazioni ----------
-- La lista iscritti è pubblica per scelta: tutti i soci del box
-- vedono chi c'è in una classe.

create policy "tutti vedono gli iscritti alle classi"
  on prenotazioni for select to authenticated
  using (
    sono_approvato()
    and exists (select 1 from sessioni s where s.id = sessione_id and s.box_id = mio_box())
  );

create policy "ci si prenota da soli"
  on prenotazioni for insert to authenticated
  with check (profilo_id = auth.uid() and puo_prenotare(auth.uid(), sessione_id));

create policy "lo staff iscrive e rimuove"
  on prenotazioni for all to authenticated
  using (ho_permesso('cl_roster') or ho_permesso('cl_attendance'))
  with check (ho_permesso('cl_roster') or ho_permesso('cl_attendance'));

create policy "ognuno disdice le proprie prenotazioni"
  on prenotazioni for update to authenticated
  using (profilo_id = auth.uid());

create policy "ognuno cancella le proprie prenotazioni"
  on prenotazioni for delete to authenticated
  using (profilo_id = auth.uid());


-- ---------- WOD ----------

create policy "tutti leggono il WOD"
  on wod for select to authenticated
  using (box_id = mio_box() and sono_approvato());

create policy "il WOD lo scrive chi ne ha il permesso"
  on wod for all to authenticated
  using (box_id = mio_box() and ho_permesso('wod_write'))
  with check (box_id = mio_box() and ho_permesso('wod_write'));

create policy "tutti leggono le versioni del WOD"
  on wod_varianti for select to authenticated
  using (exists (select 1 from wod w where w.id = wod_id and w.box_id = mio_box()));

create policy "le versioni le scrive chi scrive il WOD"
  on wod_varianti for all to authenticated
  using (ho_permesso('wod_write'))
  with check (ho_permesso('wod_write'));


-- ---------- Score ----------
-- Il proprio si vede sempre. Degli altri solo quelli non privati.
-- Lo staff vede tutto, privati compresi.

create policy "si vedono i propri score e quelli condivisi"
  on wod_score for select to authenticated
  using (
    profilo_id = auth.uid()
    or ho_permesso('wod_scores')
    or (privato = false
        and sono_approvato()
        and exists (select 1 from wod w where w.id = wod_id and w.box_id = mio_box()))
  );

create policy "ognuno salva il proprio score"
  on wod_score for insert to authenticated
  with check (profilo_id = auth.uid() and sono_approvato());

create policy "ognuno modifica il proprio score"
  on wod_score for update to authenticated
  using (profilo_id = auth.uid());

create policy "ognuno elimina il proprio score"
  on wod_score for delete to authenticated
  using (profilo_id = auth.uid());

create policy "lo staff corregge gli score"
  on wod_score for all to authenticated
  using (ho_permesso('wod_scores'))
  with check (ho_permesso('wod_scores'));


-- ---------- Esercizi e record personali ----------

create policy "tutti leggono la libreria esercizi"
  on esercizi for select to authenticated
  using (box_id is null or box_id = mio_box());

create policy "i soci aggiungono esercizi mancanti"
  on esercizi for insert to authenticated
  with check (box_id = mio_box() and sono_approvato());

create policy "i record personali sono di chi li ha fatti"
  on pr for all to authenticated
  using (profilo_id = auth.uid())
  with check (profilo_id = auth.uid());

create policy "i record condivisi si vedono"
  on pr for select to authenticated
  using (
    privato = false
    and sono_approvato()
    and exists (select 1 from profili p where p.id = profilo_id and p.box_id = mio_box())
  );


-- ---------- Comunicazioni e notifiche ----------

create policy "tutti leggono le comunicazioni"
  on comunicazioni for select to authenticated
  using (box_id = mio_box() and sono_approvato());

create policy "le comunicazioni le pubblica chi ne ha il permesso"
  on comunicazioni for all to authenticated
  using (box_id = mio_box() and (ho_permesso('com_send') or ho_permesso('com_board')))
  with check (box_id = mio_box() and (ho_permesso('com_send') or ho_permesso('com_board')));

create policy "le notifiche sono di chi le riceve"
  on notifiche for select to authenticated
  using (profilo_id = auth.uid());

create policy "si segnano come lette"
  on notifiche for update to authenticated
  using (profilo_id = auth.uid());


-- ---------- Storico operativo ----------

create policy "lo storico lo legge lo staff"
  on attivita for select to authenticated
  using (box_id = mio_box() and sono_staff());

create policy "ogni azione si registra"
  on attivita for insert to authenticated
  with check (box_id = mio_box() and autore_id = auth.uid());


-- ============================================================
-- E. POSTI E LISTA D'ATTESA
-- Chi prenota entra; a classe piena finisce in coda. Lo decide
-- il database e non l'app, altrimenti due persone che toccano
-- "Prenota" nello stesso istante prendono lo stesso posto.
-- ============================================================

create or replace function assegna_posto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  occupati int;
  capienza int;
begin
  -- Il blocco sulla sessione serializza chi arriva insieme.
  select s.capienza into capienza from sessioni s where s.id = new.sessione_id for update;

  select count(*) into occupati
  from prenotazioni
  where sessione_id = new.sessione_id and stato = 'prenotato';

  if occupati < capienza then
    new.stato := 'prenotato';
    new.posizione_coda := null;
  else
    new.stato := 'lista_attesa';
    select coalesce(max(posizione_coda), 0) + 1 into new.posizione_coda
    from prenotazioni
    where sessione_id = new.sessione_id and stato = 'lista_attesa';
  end if;

  return new;
end;
$$;

create trigger assegna_posto
  before insert on prenotazioni
  for each row
  when (new.walk_in = false)
  execute function assegna_posto();


-- Quando qualcuno disdice, il primo della coda entra.
-- Gira con i privilegi del sistema: deve spostare la prenotazione
-- di un'altra persona e scriverle una notifica, cose che chi disdice
-- non potrebbe fare da sé.
create or replace function promuove_dalla_coda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primo prenotazioni;
begin
  if old.stato = 'prenotato' and new.stato = 'disdetta' then
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

create trigger promuove_dalla_coda
  after update on prenotazioni
  for each row execute function promuove_dalla_coda();


-- ============================================================
-- F. SCHERMO TV
-- La pagina /tv/<codice> non ha login. Non le si aprono gli
-- archivi: le si dà questa sola funzione, che conosce il codice
-- e restituisce il WOD del giorno e nient'altro.
-- ============================================================

create or replace function wod_per_tv(codice text, giorno date default current_date)
returns table (
  box_nome text,
  data date,
  titolo text,
  tipo_score tipo_score,
  time_cap text,
  warm_up text,
  varianti jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select b.nome, w.data, w.titolo, w.tipo_score, w.time_cap, w.warm_up,
         coalesce(
           (select jsonb_object_agg(v.variante, v.testo)
              from wod_varianti v where v.wod_id = w.id),
           '{}'::jsonb)
  from boxes b
  left join wod w on w.box_id = b.id and w.data = giorno
  where b.tv_token = codice;
$$;

revoke all on function wod_per_tv(text, date) from public;
grant execute on function wod_per_tv(text, date) to anon, authenticated;
