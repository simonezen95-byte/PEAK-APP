-- ============================================================
-- PEAK Functional Fitness — l'utente prova
--
-- Chi viene a provare una volta occupa un posto in classe, ma non è
-- un socio: non ha account, non ha certificato, non ha abbonamento, e
-- non deve comparire da nessuna parte fra i soci.
--
-- Nella lista della classe si legge solo "Utente prova". Nessun nome,
-- nessun telefono, niente. I contatti di chi è passato a provare
-- stanno su un foglio che tiene la reception: sono un contatto
-- commerciale, non un archivio di dati di persone che non sono nostre
-- socie. Meno roba si tiene, meno roba c'è da custodire.
--
-- ------------------------------------------------------------
-- PERCHÉ NON UNA SCHEDA SOCIO FINTA
--
-- La strada ovvia sarebbe creare un profilo "Mario Prova" e
-- cancellarlo dopo. Non si può: ogni scheda socio è agganciata a un
-- accesso con email e password, e per uno che viene a provare
-- bisognerebbe inventargli un'email, fargli una password e approvarlo.
-- Assurdo, e lascerebbe account finti in giro.
--
-- Qui invece la prenotazione esiste senza nessuno dietro: tiene il
-- posto e basta. Siccome tutte le statistiche dei soci cercano le
-- righe di una certa persona, una riga senza persona non le trova
-- nessuna. L'esclusione è automatica, non una regola da ricordarsi.
--
-- ------------------------------------------------------------
-- UN CAMBIO CHE TOCCA LE PRESENZE
--
-- Finora le presenze si confermavano passando l'elenco dei soci
-- presenti. Un utente prova non ha un socio da passare, quindi
-- risulterebbe sempre assente. Da qui in avanti si passano gli
-- identificativi delle RIGHE della lista, che ce l'hanno tutti.
--
-- Da eseguire dopo gli altri diciotto file.
-- ============================================================


-- ============================================================
-- 1. UNA PRENOTAZIONE SENZA NESSUNO DIETRO
-- ============================================================

alter table prenotazioni
  alter column profilo_id drop not null;

alter table prenotazioni
  add column if not exists prova boolean not null default false;

-- O è di un socio, o è una prova: mai tutt'e due, mai nessuna delle
-- due. Senza questo vincolo basterebbe una svista per ritrovarsi
-- righe che non si sa di chi sono.
alter table prenotazioni
  drop constraint if exists prenotazioni_prova_o_socio;

alter table prenotazioni
  add constraint prenotazioni_prova_o_socio check (
    (prova and profilo_id is null) or (not prova and profilo_id is not null)
  );

comment on column prenotazioni.prova is
  'Riga di un utente prova: occupa un posto in classe ma non è di '
  'nessun socio. Non ha profilo_id, e per questo resta fuori da tutte '
  'le statistiche dei soci senza bisogno di filtrarla.';


-- ============================================================
-- 2. AGGIUNGERE UNA PROVA
--
-- Stessa regola dei walk-in: entra solo se c'è posto. Chi viene a
-- provare toglie un posto a un socio esattamente come chiunque altro.
-- ============================================================

create or replace function aggiungi_prova(sess uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s        sessioni;
  posti    int;
  occupati int;
  nuova    uuid;
begin
  select * into s from sessioni where id = sess for update;

  if s.id is null or s.box_id <> mio_box()
     or not (posso_chiudere(sess) or ho_permesso('cl_roster')) then
    raise exception 'Non puoi aggiungere nessuno a questa classe.';
  end if;

  if s.annullata then
    raise exception 'Questa lezione è annullata.';
  end if;

  select count(*) into occupati
  from prenotazioni
  where sessione_id = sess and stato in ('prenotato', 'presente');

  if occupati >= s.capienza then
    raise exception 'La classe è al completo.';
  end if;

  -- Nasce già presente: una prova si aggiunge quando la persona è lì.
  insert into prenotazioni (sessione_id, profilo_id, stato, prova, walk_in, iscritto_da)
  values (sess, null, 'presente', true, true, auth.uid())
  returning id into nuova;

  return nuova;
end;
$$;

revoke all on function aggiungi_prova(uuid) from public;
grant execute on function aggiungi_prova(uuid) to authenticated;


/** Togliere una riga qualsiasi dalla classe, socio o prova che sia.
    Per le prove serve per forza: non hanno un socio da nominare. */
create or replace function togli_riga(riga uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p prenotazioni;
begin
  select * into p from prenotazioni where id = riga;
  if p.id is null then return; end if;

  if not (posso_chiudere(p.sessione_id) or ho_permesso('cl_roster')) then
    raise exception 'Non puoi modificare questa classe.';
  end if;

  -- Una prova si cancella davvero: non c'è nessuno a cui interessi
  -- sapere che era stata segnata. Di un socio invece resta la riga
  -- disdetta, perché è la sua storia.
  if p.prova then
    delete from prenotazioni where id = riga;
  else
    update prenotazioni
    set stato = 'disdetta', disdetta_il = now()
    where id = riga;
  end if;
end;
$$;

revoke all on function togli_riga(uuid) from public;
grant execute on function togli_riga(uuid) to authenticated;


-- ============================================================
-- 3. LA LISTA DA SPUNTARE, CON LE PROVE DENTRO
--
-- Il collegamento alla scheda socio diventa facoltativo: senza, la
-- riga sparirebbe dall'elenco e il coach si troverebbe a spuntare
-- meno gente di quanta ne ha davanti.
-- ============================================================

drop function if exists elenco_presenze(uuid);

create function elenco_presenze(sess uuid)
returns table (
  prenotazione_id uuid,
  profilo_id      uuid,
  nome            text,
  cognome         text,
  foto_url        text,
  stato           stato_prenotazione,
  posizione_coda  int,
  walk_in         boolean,
  prova           boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.profilo_id,
    case when p.prova then 'Utente' else pr.nome end,
    case when p.prova then 'prova'  else pr.cognome end,
    pr.foto_url,
    p.stato, p.posizione_coda, p.walk_in, p.prova
  from prenotazioni p
  left join profili pr on pr.id = p.profilo_id
  join sessioni s on s.id = p.sessione_id
  where p.sessione_id = sess
    and s.box_id = mio_box()
    and ho_permesso('cl_attendance')
    and p.stato <> 'disdetta'
  order by
    case p.stato when 'lista_attesa' then 1 else 0 end,
    p.posizione_coda nulls first,
    -- Le prove in fondo ai presenti: sono l'eccezione della giornata.
    p.prova,
    pr.cognome, pr.nome;
$$;

revoke all on function elenco_presenze(uuid) from public;
grant execute on function elenco_presenze(uuid) to authenticated;


-- ============================================================
-- 4. CONFERMARE LE PRESENZE — adesso per righe, non per soci
--
-- Prima arrivava l'elenco dei soci presenti. Un utente prova non ha
-- un socio da mettere in quell'elenco, quindi sarebbe risultato
-- sempre assente. Adesso arriva l'elenco delle righe spuntate, che
-- esistono per tutti.
-- ============================================================

drop function if exists segna_presenze(uuid, uuid[]);

create function segna_presenze(sess uuid, righe uuid[])
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  quanti int;
  spunte uuid[] := coalesce(righe, '{}'::uuid[]);
begin
  if not posso_chiudere(sess) then
    raise exception 'Non puoi confermare le presenze di questa classe.';
  end if;

  update prenotazioni p
  set stato = case when p.id = any(spunte) then 'presente' else 'assente' end::stato_prenotazione
  where p.sessione_id = sess
    and p.stato in ('prenotato', 'presente', 'assente');

  -- Chi era in coda ed è entrato davvero. Gli altri restano in coda:
  -- non si era mai liberato un posto per loro, non è un'assenza.
  update prenotazioni p
  set stato = 'presente'
  where p.sessione_id = sess
    and p.stato = 'lista_attesa'
    and p.id = any(spunte);

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
-- 5. QUANTE PROVE
--
-- Il numero commerciale: quante persone sono venute a provare in un
-- periodo. Conta solo quelle confermate presenti dal coach, come
-- tutto il resto.
-- ============================================================

create or replace function quante_prove(dal date, al date)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where s.box_id = mio_box()
    and p.prova
    and p.stato = 'presente'
    and s.data between dal and al
    and ho_permesso('soci_view');
$$;

revoke all on function quante_prove(date, date) from public;
grant execute on function quante_prove(date, date) to authenticated;


-- ============================================================
-- 6. CONTROLLO
-- ============================================================

select
  'prove questo mese' as cosa,
  quante_prove(date_trunc('month', current_date)::date, current_date) as quante;
