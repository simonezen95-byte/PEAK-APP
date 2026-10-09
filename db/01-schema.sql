-- ============================================================
-- PEAK Functional Fitness — struttura del database
-- Supabase (PostgreSQL)
--
-- Come si legge: ogni "table" è un archivio, cioè un elenco di
-- schede tutte uguali. Le righe dentro sono i campi di quella
-- scheda. "references" significa "questo campo punta a una scheda
-- di un altro archivio".
--
-- Questo file crea solo gli archivi vuoti. Le regole su chi può
-- leggere e scrivere cosa vengono dopo, in un file a parte.
-- ============================================================


-- ============================================================
-- 1. LA PALESTRA
-- Oggi c'è una riga sola, PEAK. La colonna box_id sugli altri
-- archivi serve a non doverli rifare se un domani se ne aggiunge
-- un'altra.
-- ============================================================

create table boxes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  indirizzo     text,
  cap           text,
  comune        text,
  provincia     text,
  telefono      text,
  email         text,
  piva          text,
  codice_fiscale text,

  -- Codice segreto nell'indirizzo dello schermo TV: /tv/<tv_token>.
  -- Si rigenera dalle impostazioni se finisce in giro.
  tv_token      text unique not null
                  default replace(gen_random_uuid()::text, '-', ''),

  creato_il     timestamptz not null default now()
);


-- ============================================================
-- 2. LE PERSONE
-- Un archivio solo per soci, coach e admin: chi ha un ruolo resta
-- socio a tutti gli effetti (prenota, ha i suoi progressi).
-- Questo risolve il punto rimasto aperto nelle decisioni, dove
-- staff e soci erano due elenchi separati.
--
-- Email e password NON stanno qui: le gestisce Supabase nel suo
-- archivio auth.users, che è cifrato. Qui c'è solo il collegamento.
-- ============================================================

create type stato_profilo as enum (
  'in_attesa',   -- registrato, aspetta l'approvazione dell'admin
  'approvato',   -- può entrare nell'app
  'sospeso'      -- bloccato dallo staff, storico conservato
);

create type ruolo_profilo as enum ('socio', 'coach', 'admin', 'owner');

create table profili (
  id              uuid primary key references auth.users(id) on delete cascade,
  box_id          uuid not null references boxes(id),

  -- Anagrafica. Nome, cognome e data di nascita li cambia solo
  -- l'admin, dopo aver visto un documento.
  nome            text not null,
  cognome         text not null,
  email           text not null,
  telefono        text not null,
  data_nascita    date not null,
  comune          text,
  foto_url        text,

  numero_tessera  int generated always as identity,

  stato           stato_profilo not null default 'in_attesa',
  ruolo           ruolo_profilo not null default 'socio',

  -- Caselle dei permessi oltre al preset del ruolo.
  -- Esempio: { "wod_write": true } a un coach.
  permessi        jsonb not null default '{}'::jsonb,

  -- Scadenza del certificato medico. È un dato sanitario: in app
  -- c'è solo la data, il cartaceo resta in reception.
  certificato_scadenza date,
  certificato_registrato_da uuid references profili(id),
  certificato_registrato_il timestamptz,

  -- Preferenze del socio
  privacy         jsonb not null default
                    '{"mostra_score": true, "mostra_pr": true}'::jsonb,
  notifiche       jsonb not null default
                    '{"prenotazioni": true, "abbonamento": true, "comunicazioni": true}'::jsonb,

  -- Cambio email fatto dal socio: resta segnalato finché l'admin
  -- non lo marca come verificato.
  email_cambiata_il    timestamptz,
  email_verificata_il  timestamptz,

  iscritto_il     timestamptz not null default now(),
  approvato_da    uuid references profili(id),
  approvato_il    timestamptz,
  staff_dal       date,

  unique (box_id, email)
);

create index on profili (box_id, stato);
create index on profili (box_id, ruolo) where ruolo <> 'socio';


-- ============================================================
-- 3. CONSENSI PRIVACY
-- Obbligo di legge: bisogna poter dimostrare chi ha accettato
-- cosa e quando. Una riga per ogni consenso dato o revocato,
-- così resta lo storico.
-- ============================================================

create type tipo_consenso as enum (
  'informativa',   -- obbligatorio per iscriversi
  'foto_video'     -- facoltativo, revocabile
);

create table consensi (
  id              bigint primary key generated always as identity,
  profilo_id      uuid not null references profili(id) on delete cascade,
  tipo            tipo_consenso not null,
  versione        text not null,        -- es. "1.0" dell'informativa accettata
  accettato       boolean not null,     -- false = revoca
  registrato_il   timestamptz not null default now()
);

create index on consensi (profilo_id, tipo, registrato_il desc);


-- ============================================================
-- 4. CATALOGO PACCHETTI
-- Abbonamenti e pacchetti Personal. Si creano e si modificano
-- dalla sezione Abbonamenti: non sono scritti nel codice.
-- ============================================================

create type tipo_pacchetto as enum ('abbonamento', 'personal');

create table pacchetti (
  id              uuid primary key default gen_random_uuid(),
  box_id          uuid not null references boxes(id),
  tipo            tipo_pacchetto not null default 'abbonamento',
  nome            text not null,
  prezzo          numeric(7,2) not null,
  mesi            int not null default 1,

  -- Solo abbonamenti: quanti ingressi include (vuoto = illimitati)
  -- e se apre anche le classi (falso = solo Open Box).
  ingressi        int,
  include_classi  boolean not null default true,

  -- Solo Personal: quante sessioni include.
  sessioni        int,

  attivo          boolean not null default true,
  creato_il       timestamptz not null default now()
);


-- ============================================================
-- 5. ABBONAMENTI DEI SOCI
-- Una riga per ogni abbonamento o pacchetto Personal venduto.
-- Non si sovrascrive mai: il rinnovo è una riga nuova, così la
-- cronologia resta.
-- ============================================================

create table abbonamenti (
  id              uuid primary key default gen_random_uuid(),
  profilo_id      uuid not null references profili(id) on delete cascade,
  pacchetto_id    uuid not null references pacchetti(id),
  tipo            tipo_pacchetto not null,

  inizio          date not null,
  fine            date not null,
  pagato          boolean not null default true,

  -- Contatori: ingressi per gli abbonamenti, sessioni per i Personal.
  -- Vuoto significa illimitato.
  residui         int,
  totali          int,

  registrato_da   uuid references profili(id),
  creato_il       timestamptz not null default now(),

  check (fine >= inizio)
);

create index on abbonamenti (profilo_id, fine desc);


-- ============================================================
-- 6. QUOTE ASSOCIATIVE
-- Cosa distinta dall'abbonamento: tessera l'ASD e scade il
-- 31 agosto per tutti, qualunque sia la data di versamento.
-- ============================================================

create table quote (
  id              bigint primary key generated always as identity,
  profilo_id      uuid not null references profili(id) on delete cascade,
  anno_sportivo   int not null,          -- 2027 = anno che chiude il 31/08/2027
  versata_il      date not null default current_date,
  importo         numeric(7,2),
  registrata_da   uuid references profili(id),

  unique (profilo_id, anno_sportivo)
);


-- ============================================================
-- 7. PALINSESTO
-- Il modello settimanale: "il lunedì c'è classe alle 06:30".
-- Da qui si generano le sessioni vere dei singoli giorni.
-- ============================================================

create type tipo_sessione as enum ('classe', 'openbox');

create table palinsesto (
  id              uuid primary key default gen_random_uuid(),
  box_id          uuid not null references boxes(id),
  giorno          int not null check (giorno between 0 and 6),  -- 0 = domenica
  ora             time not null,
  durata_min      int not null default 60,
  tipo            tipo_sessione not null default 'classe',
  nome            text not null default 'Functional',
  capienza        int not null,
  coach_id        uuid references profili(id),
  attivo          boolean not null default true,

  unique (box_id, giorno, ora, tipo)
);


-- ============================================================
-- 8. SESSIONI
-- Le classi e le fasce Open Box dei singoli giorni, generate dal
-- palinsesto. Esistono come righe vere perché ci si prenota sopra
-- e perché una singola giornata può cambiare (coach diverso,
-- classe annullata) senza toccare il modello settimanale.
-- ============================================================

create table sessioni (
  id              uuid primary key default gen_random_uuid(),
  box_id          uuid not null references boxes(id),
  palinsesto_id   uuid references palinsesto(id),

  data            date not null,
  ora             time not null,
  durata_min      int not null default 60,
  tipo            tipo_sessione not null,
  nome            text not null default 'Functional',
  capienza        int not null,
  coach_id        uuid references profili(id),

  annullata       boolean not null default false,
  motivo_annullo  text,

  -- Si valorizzano quando il coach conferma le presenze.
  presenze_confermate_da uuid references profili(id),
  presenze_confermate_il timestamptz,

  unique (box_id, data, ora, tipo)
);

create index on sessioni (box_id, data);


-- ============================================================
-- 9. PRENOTAZIONI E PRESENZE
-- Una riga sola copre tutto il percorso: prenotato → presente.
-- Chi arriva senza prenotazione entra qui con walk_in = true.
-- ============================================================

create type stato_prenotazione as enum (
  'prenotato',
  'lista_attesa',
  'disdetta',
  'presente',
  'assente'
);

create table prenotazioni (
  id              uuid primary key default gen_random_uuid(),
  sessione_id     uuid not null references sessioni(id) on delete cascade,
  profilo_id      uuid not null references profili(id) on delete cascade,

  stato           stato_prenotazione not null default 'prenotato',
  posizione_coda  int,                  -- solo per chi è in lista d'attesa
  walk_in         boolean not null default false,

  prenotato_il    timestamptz not null default now(),
  disdetta_il     timestamptz,
  -- Chi ha iscritto il socio: vuoto se si è prenotato da solo.
  iscritto_da     uuid references profili(id),

  -- Un socio non può prenotare due volte la stessa sessione.
  unique (sessione_id, profilo_id)
);

create index on prenotazioni (profilo_id, stato);
create index on prenotazioni (sessione_id, stato);


-- ============================================================
-- 10. WOD
-- Un WOD al giorno. Le tre versioni stanno in un archivio a parte
-- perché Scaled e Open sono facoltative.
-- ============================================================

create type tipo_score as enum ('tempo', 'ripetizioni', 'carico');
create type variante_wod as enum ('RX', 'SCALED', 'OPEN');

create table wod (
  id              uuid primary key default gen_random_uuid(),
  box_id          uuid not null references boxes(id),
  data            date not null,

  titolo          text not null,        -- "FOR TIME", "AMRAP 20'"
  tipo_score      tipo_score not null,
  time_cap        text,                 -- "20:00", vuoto se non c'è

  -- Riscaldamento: si vede solo sullo schermo TV e nel gestionale,
  -- mai nell'app dei soci.
  warm_up         text,

  autore_id       uuid references profili(id),
  pubblicato_il   timestamptz not null default now(),
  modificato_da   uuid references profili(id),
  modificato_il   timestamptz,

  unique (box_id, data)
);

create table wod_varianti (
  id              bigint primary key generated always as identity,
  wod_id          uuid not null references wod(id) on delete cascade,
  variante        variante_wod not null,
  testo           text not null,        -- una riga per movimento

  unique (wod_id, variante)
);


-- ============================================================
-- 11. SCORE DEI WOD
-- Il valore è sempre un numero, così la classifica si ordina:
--   tempo       → secondi (12:30 diventa 750)
--   ripetizioni → il numero
--   carico      → chili con un decimale
-- ============================================================

create table wod_score (
  id              uuid primary key default gen_random_uuid(),
  wod_id          uuid not null references wod(id) on delete cascade,
  profilo_id      uuid not null references profili(id) on delete cascade,
  variante        variante_wod not null,
  valore          numeric(7,1) not null,

  -- Privato = il socio lo vede nei suoi progressi, ma non compare
  -- in classifica. Lo staff lo vede comunque.
  privato         boolean not null default false,

  salvato_il      timestamptz not null default now(),
  corretto_da     uuid references profili(id),
  corretto_il     timestamptz,

  unique (wod_id, profilo_id)
);

create index on wod_score (wod_id, variante, valore);


-- ============================================================
-- 12. LIBRERIA ESERCIZI E PERSONAL RECORD
-- Gli esercizi con box_id vuoto sono la libreria di base, uguale
-- per tutti. Quelli con box_id sono aggiunte fatte dai soci.
-- ============================================================

create table esercizi (
  id              uuid primary key default gen_random_uuid(),
  box_id          uuid references boxes(id),
  nome            text not null,
  categoria       text not null,
  creato_da       uuid references profili(id),

  unique nulls not distinct (box_id, nome)
);

create type tipo_massimale as enum ('1RM', '2RM', '3RM', '5RM', '10RM');

create table pr (
  id              uuid primary key default gen_random_uuid(),
  profilo_id      uuid not null references profili(id) on delete cascade,
  esercizio_id    uuid not null references esercizi(id),
  tipo            tipo_massimale not null,
  valore          numeric(6,2) not null,     -- chili
  data            date not null default current_date,
  privato         boolean not null default false,
  creato_il       timestamptz not null default now()
);

create index on pr (profilo_id, esercizio_id, data desc);


-- ============================================================
-- 13. COMUNICAZIONI E NOTIFICHE
-- ============================================================

create type tipo_comunicazione as enum ('avviso', 'comunicazione');

create table comunicazioni (
  id              uuid primary key default gen_random_uuid(),
  box_id          uuid not null references boxes(id),
  tipo            tipo_comunicazione not null default 'comunicazione',
  titolo          text not null,
  testo           text not null,
  autore_id       uuid references profili(id),
  pubblicata_il   timestamptz not null default now()
);

create table notifiche (
  id              bigint primary key generated always as identity,
  profilo_id      uuid not null references profili(id) on delete cascade,
  gruppo          text not null,        -- prenotazioni, lista_attesa, abbonamento…
  titolo          text not null,
  testo           text,
  link            text,                 -- dove porta toccandola
  letta_il        timestamptz,
  creata_il       timestamptz not null default now()
);

create index on notifiche (profilo_id, letta_il nulls first, creata_il desc);


-- ============================================================
-- 14. STORICO OPERATIVO
-- Chi ha fatto cosa: conferme presenze, approvazioni, WOD
-- pubblicati, rinnovi. Serve a ricostruire, non a sorvegliare.
-- ============================================================

create table attivita (
  id              bigint primary key generated always as identity,
  box_id          uuid not null references boxes(id),
  autore_id       uuid references profili(id),
  azione          text not null,        -- "presenze_confermate", "socio_approvato"
  oggetto_tipo    text,                 -- "sessione", "profilo", "wod"
  oggetto_id      uuid,
  dettaglio       jsonb,
  creata_il       timestamptz not null default now()
);

create index on attivita (box_id, creata_il desc);
