-- Semina per provare le presenze: un owner, due coach, tre soci,
-- due classi di ieri (una per coach) e una di stamattina.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@peak.it'),
  ('22222222-2222-2222-2222-222222222222', 'coach1@peak.it'),
  ('33333333-3333-3333-3333-333333333333', 'coach2@peak.it'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'socio1@peak.it'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'socio2@peak.it'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'socio3@peak.it'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'socio4@peak.it');

insert into profili (id, box_id, nome, cognome, email, telefono, data_nascita, stato, ruolo, certificato_scadenza)
select u.id, (select id from boxes limit 1), v.nome, v.cognome, u.email, '3330000000', '1990-01-01',
       'approvato', v.ruolo::ruolo_profilo, current_date + 200
from auth.users u
join (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Simone','Zen','owner'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Luca','Rossi','coach'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Anna','Bianchi','coach'),
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Marco','Alfa','socio'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'Giulia','Beta','socio'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'Paolo','Gamma','socio'),
  ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'Sara','Delta','socio')
) as v(id, nome, cognome, ruolo) on v.id = u.id;

-- Quota e abbonamento per tutti i soci, così puo_prenotare dice sì.
-- L'anno sportivo scade il 31 agosto: da settembre in poi è quello dopo.
insert into quote (profilo_id, anno_sportivo, importo, versata_il)
select id,
       extract(year from current_date)::int
         + case when extract(month from current_date) >= 9 then 1 else 0 end,
       50, current_date
from profili where ruolo = 'socio';

insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, residui, pagato)
select p.id, (select id from pacchetti where include_classi limit 1), 'abbonamento',
       current_date - 30, current_date + 30, null, true
from profili p where p.ruolo = 'socio';

-- Tre classi: ieri 18:00 (coach Luca), ieri 19:00 (coach Anna),
-- oggi 06:30 (coach Luca). Capienza 3, per provare il pieno.
insert into sessioni (id, box_id, data, ora, durata_min, tipo, nome, capienza, coach_id) values
  ('cccccccc-0000-0000-0000-00000000000a', (select id from boxes limit 1),
   current_date - 1, '18:00', 60, 'classe', 'Functional', 3, '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000b', (select id from boxes limit 1),
   current_date - 1, '19:00', 60, 'classe', 'Functional', 3, '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', (select id from boxes limit 1),
   current_date, '06:30', 60, 'classe', 'Functional', 3, '22222222-2222-2222-2222-222222222222');

-- Alla classe di ieri 18:00: tre prenotati (piena) + uno in coda.
insert into prenotazioni (sessione_id, profilo_id, stato, posizione_coda) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'prenotato', null),
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000002', 'prenotato', null),
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000003', 'prenotato', null),
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000004', 'lista_attesa', 1);

-- Alla classe di stamattina 06:30: Marco solo.
insert into prenotazioni (sessione_id, profilo_id, stato) values
  ('cccccccc-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001', 'prenotato');

select 'seminato' as esito, (select count(*) from profili) as profili,
       (select count(*) from sessioni) as sessioni,
       (select count(*) from prenotazioni) as prenotazioni;
