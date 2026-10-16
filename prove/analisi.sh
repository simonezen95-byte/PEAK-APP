#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sull'analisi dello stato dei soci.
OWNER=11111111-1111-1111-1111-111111111111
M1=aaaaaaaa-0000-0000-0000-000000000001   # Marco  — si allena
M2=aaaaaaaa-0000-0000-0000-000000000002   # Giulia — paga e non viene
M3=aaaaaaaa-0000-0000-0000-000000000003   # Paolo  — fermo, abbonamento scaduto
M4=aaaaaaaa-0000-0000-0000-000000000004   # Sara   — mai venuta
LUCA=22222222-2222-2222-2222-222222222222

come() { psql -X -q -c "set role authenticated; set jwt.sub='$1'; $2"; }
riga() { echo; echo "──── $1"; }

# ============================================================
# Lo scenario
# ============================================================
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
-- Iscrizioni spalmate nel tempo: senza questo tutti sono iscritti
-- oggi e "fermo" non vuol dire niente.
update profili set iscritto_il = now() - interval '120 days'
 where id in ('aaaaaaaa-0000-0000-0000-000000000001',
              'aaaaaaaa-0000-0000-0000-000000000002',
              'aaaaaaaa-0000-0000-0000-000000000003');
update profili set iscritto_il = now() - interval '60 days'
 where id = 'aaaaaaaa-0000-0000-0000-000000000004';

-- Sessioni passate. Ore insolite per non pestare quelle del
-- palinsesto finto che c'è già.
insert into sessioni (id, box_id, data, ora, durata_min, tipo, capienza, coach_id, nome)
select
  ('dddddddd-0000-0000-0000-00000000000' || n)::uuid,
  (select id from boxes limit 1),
  current_date - (n * 10), '21:45', 60, 'classe', 12,
  '22222222-2222-2222-2222-222222222222', 'Storica ' || n
from generate_series(1, 6) n
on conflict (id) do nothing;

insert into sessioni (id, box_id, data, ora, durata_min, tipo, capienza, coach_id, nome)
values ('dddddddd-0000-0000-0000-0000000000ff',
        (select id from boxes limit 1),
        current_date - 1, '21:45', 60, 'classe', 12,
        '22222222-2222-2222-2222-222222222222', 'Ieri')
on conflict (id) do nothing;

-- Le prenotazioni: lo stato lo mette un automatismo del database, va
-- corretto dopo. Marco presente ieri, Giulia 40 giorni fa, Paolo 30.
insert into prenotazioni (sessione_id, profilo_id) values
  ('dddddddd-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003'),
  -- Marco ha prenotato e NON si è presentato 10 giorni fa.
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001')
on conflict (sessione_id, profilo_id) do nothing;

update prenotazioni set stato = 'presente'
 where sessione_id in ('dddddddd-0000-0000-0000-0000000000ff',
                       'dddddddd-0000-0000-0000-000000000004',
                       'dddddddd-0000-0000-0000-000000000003');
update prenotazioni set stato = 'assente'
 where sessione_id = 'dddddddd-0000-0000-0000-000000000001';

-- Paolo: abbonamento scaduto venti giorni fa.
update abbonamenti
set inizio = current_date - 90, fine = current_date - 20
where profilo_id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- Scadenze: certificato di Marco fra 10 giorni, abbonamento di
-- Giulia fra 5, certificato di Luca (coach) scaduto 3 giorni fa.
update profili set certificato_scadenza = current_date + 10
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update abbonamenti set fine = current_date + 5
 where profilo_id = 'aaaaaaaa-0000-0000-0000-000000000002';
update profili set certificato_scadenza = current_date - 3
 where id = '22222222-2222-2222-2222-222222222222';
SQL

riga "0. Lo scenario è in piedi"
psql -X -c "select p.cognome, pr.stato, s.data
  from prenotazioni pr join sessioni s on s.id=pr.sessione_id
  join profili p on p.id=pr.profilo_id
  where pr.sessione_id::text like 'dddddddd%' order by s.data;"

riga "1. I numeri in testa"
come $OWNER "select * from analisi_soci();"

riga "2. Chi si è fermato — in cima chi paga e non viene"
come $OWNER "select cognome, ultima, giorni_fermo, mai_venuto, abbonamento, paga_e_non_viene from soci_fermi(3);"

riga "3. Marco è prenotato-assente 10 giorni fa: la sua ultima presenza resta ieri"
come $OWNER "select ultima_presenza('$M1') as marco, current_date - 1 as atteso;"

riga "4. Cosa sta scadendo (finestra 30 giorni)"
come $OWNER "select cognome, genere, cosa, quando, giorni_a, scaduta from scadenze_prossime(30);"

riga "5. Il coach col certificato scaduto c'è nelle scadenze..."
come $OWNER "select count(*) as righe_luca from scadenze_prossime(30) where profilo_id='$LUCA';"

riga "6. ...ma NON nella lista di chi si è fermato"
come $OWNER "select count(*) as righe_staff from soci_fermi(1)
  where id in ('$OWNER','$LUCA','33333333-3333-3333-3333-333333333333');"

riga "7. La finestra si allarga e si stringe"
come $OWNER "select
  (select count(*) from soci_fermi(1)) as fermi_1set,
  (select count(*) from soci_fermi(3)) as fermi_3set,
  (select count(*) from soci_fermi(8)) as fermi_8set,
  (select count(*) from soci_fermi(20)) as fermi_20set,
  (select count(*) from scadenze_prossime(7)) as scad_7,
  (select count(*) from scadenze_prossime(90)) as scad_90;"

riga "8. Un socio qualunque non vede niente di tutto questo"
come $M1 "select * from analisi_soci();"
come $M1 "select count(*) as righe_fermi from soci_fermi(3);"
come $M1 "select count(*) as righe_scad from scadenze_prossime(30);"

riga "9. Un coach: soci_view ce l'ha di ruolo, quindi vede"
come $LUCA "select soci, attivi, fermi from analisi_soci();"

riga "10. Chi ha rinnovato non compare fra le scadenze"
come $OWNER "select cognome, quando from scadenze_prossime(30) where profilo_id='$M2';"
psql -X -q -c "insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
  select 'aaaaaaaa-0000-0000-0000-000000000002',
         (select id from pacchetti where tipo='abbonamento' limit 1),
         'abbonamento', true, current_date + 6, current_date + 36;"
echo "  (dopo il rinnovo:)"
come $OWNER "select count(*) as righe_giulia from scadenze_prossime(30) where profilo_id='$M2' and genere='abbonamento';"

riga "11. Il numero grande e la lista dicono la stessa cosa"
come $OWNER "select
  (select fermi from analisi_soci()) as fermi_numero,
  (select count(*) from soci_fermi(3)) as fermi_lista,
  (select scadenze_30g from analisi_soci()) as scad_numero,
  (select count(*) from scadenze_prossime(30)) as scad_lista;"

riepilogo
