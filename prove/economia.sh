#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sull'economia.
O=11111111-1111-1111-1111-111111111111
LUCA=22222222-2222-2222-2222-222222222222
M1=aaaaaaaa-0000-0000-0000-000000000001
M2=aaaaaaaa-0000-0000-0000-000000000002
M3=aaaaaaaa-0000-0000-0000-000000000003
M4=aaaaaaaa-0000-0000-0000-000000000004

come() { psql -X -q -c "set role authenticated; set jwt.sub='$1'; $2" 2>&1 | head -14; }
riga() { echo; echo "──── $1"; }

# ============================================================
# Lo scenario: prezzi noti, così i conti si possono verificare a mano
# ============================================================
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
delete from abbonamenti;
delete from quote;
delete from pacchetti where nome in ('Omaggio','Prova di controllo');

update pacchetti set prezzo = 60, attivo = true where nome = 'Mensile libero';
update pacchetti set prezzo = 55, attivo = true where nome = 'Mensile 2 a settimana';
insert into pacchetti (box_id, tipo, nome, prezzo, mesi, include_classi)
 select id, 'abbonamento', 'Omaggio', 0, 1, true from boxes
 where not exists (select 1 from pacchetti where nome='Omaggio');

-- Marco: mensile libero partito questo mese, pagato.      60
insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
 select 'aaaaaaaa-0000-0000-0000-000000000001',
        (select id from pacchetti where nome='Mensile libero'),
        'abbonamento', true, current_date - 2, current_date + 28;

-- Giulia: 2 a settimana, parte questo mese, scade fra 20 gg. 55
insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
 select 'aaaaaaaa-0000-0000-0000-000000000002',
        (select id from pacchetti where nome='Mensile 2 a settimana'),
        'abbonamento', true, current_date - 10, current_date + 20;

-- Paolo: mensile libero NON pagato, in corso.             60 sospeso
insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
 select 'aaaaaaaa-0000-0000-0000-000000000003',
        (select id from pacchetti where nome='Mensile libero'),
        'abbonamento', false, current_date - 5, current_date + 25;

-- Sara: omaggio.                                           0
insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
 select 'aaaaaaaa-0000-0000-0000-000000000004',
        (select id from pacchetti where nome='Omaggio'),
        'abbonamento', true, current_date, current_date + 30;

-- Un mensile vecchio di tre mesi, gia' finito.             60
insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
 select 'aaaaaaaa-0000-0000-0000-000000000001',
        (select id from pacchetti where nome='Mensile libero'),
        'abbonamento', true, current_date - 90, current_date - 60;

-- Due quote da 30 euro versate questo mese.               60
insert into quote (profilo_id, anno_sportivo, versata_il, importo) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 2027, current_date, 30),
 ('aaaaaaaa-0000-0000-0000-000000000002', 2027, current_date, 30);
SQL

riga "1. Il riassunto. Attesi: attivi 3 (60+55+0=115), questo mese 60+55+0+60quote=175"
come $O "select * from economia_riassunto();"

riga "2. Sospeso: Paolo, 60 euro promessi e non incassati"
come $O "select sospeso_quanti, sospeso_valore from economia_riassunto();"

riga "3. In scadenza entro 30 giorni: Marco(28gg,60) Giulia(20gg,55) Sara(30gg,0) = 3, 115"
come $O "select scadenze_quanti, scadenze_valore from economia_riassunto();"

riga "4. Se Marco rinnova, esce dalle scadenze e il valore cala di 60"
psql -X -q -c "insert into abbonamenti (profilo_id, pacchetto_id, tipo, pagato, inizio, fine)
 select 'aaaaaaaa-0000-0000-0000-000000000001',
        (select id from pacchetti where nome='Mensile libero'),
        'abbonamento', true, current_date + 20, current_date + 50;"
come $O "select scadenze_quanti, scadenze_valore from economia_riassunto();"

riga "5. Mese per mese: ultimi 4 mesi, compresi quelli vuoti"
come $O "select mese, abbonamenti, quote, totale, quanti from economia_per_mese(4);"

riga "6. Quale pacchetto tira"
come $O "select pacchetto, prezzo, venduti, valore, attivi, spento from economia_per_pacchetto(12);"

riga "7. Un pacchetto mai venduto compare lo stesso, a zero"
psql -X -q -c "insert into pacchetti (box_id, tipo, nome, prezzo, mesi, include_classi)
 select id, 'abbonamento', 'Mai venduto', 99, 1, true from boxes
 where not exists (select 1 from pacchetti where nome='Mai venduto');"
come $O "select pacchetto, venduti, valore from economia_per_pacchetto(12) where pacchetto='Mai venduto';"

riga "8. Un coach NON vede i soldi (non ha abb_view)"
come $LUCA "select * from economia_riassunto();"
come $LUCA "select count(*) as righe from economia_per_mese(4);"
come $LUCA "select count(*) as righe from economia_per_pacchetto(12);"

riga "9. Un socio nemmeno"
come $M1 "select count(*) as righe from economia_per_pacchetto(12);"

riepilogo
