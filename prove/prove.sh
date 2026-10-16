#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sull'analisi delle prove.
O=11111111-1111-1111-1111-111111111111
LUCA=22222222-2222-2222-2222-222222222222
M1=aaaaaaaa-0000-0000-0000-000000000001

come() { psql -X -q -c "set role authenticated; set jwt.sub='$1'; $2" 2>&1 | head -14; }
riga() { echo; echo "──── $1"; }

# ============================================================
# Lo scenario: prove sparse su tre mesi, con esiti noti
# ============================================================
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
delete from prenotazioni where prova;
delete from sessioni where id::text like 'eeeeeeee%';

insert into sessioni (id, box_id, data, ora, durata_min, tipo, capienza, coach_id, nome)
select ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid,
       (select id from boxes limit 1),
       current_date - (n * 20), '20:15', 60, 'classe', 12,
       '22222222-2222-2222-2222-222222222222', 'Functional'
from generate_series(1, 6) n;
SQL

# otto prove: provenienze diverse, esiti diversi, due in sospeso
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
insert into prenotazioni (sessione_id, profilo_id, stato, prova, prova_fonte, prova_esito)
values
 ('eeeeeeee-0000-0000-0000-000000000001', null, 'presente', true, 'social',      true),
 ('eeeeeeee-0000-0000-0000-000000000001', null, 'presente', true, 'social',      false),
 ('eeeeeeee-0000-0000-0000-000000000002', null, 'presente', true, 'social',      true),
 ('eeeeeeee-0000-0000-0000-000000000002', null, 'presente', true, 'passaparola', true),
 ('eeeeeeee-0000-0000-0000-000000000003', null, 'presente', true, 'passaparola', true),
 ('eeeeeeee-0000-0000-0000-000000000003', null, 'presente', true, 'amico',       false),
 ('eeeeeeee-0000-0000-0000-000000000004', null, 'presente', true, 'internet',    null),
 ('eeeeeeee-0000-0000-0000-000000000005', null, 'presente', true, null,          null);

-- Lo stato lo riscrive un automatismo del database all'inserimento:
-- va rimesso a mano, altrimenti le prove nascono "prenotate" e
-- nessuna funzione le trova.
update prenotazioni set stato = 'presente'
 where prova and sessione_id::text like 'eeeeeeee%';
SQL

riga "1. Il riassunto. Otto prove: 4 convertite, 2 perse, 2 in sospeso."
echo "   Il tasso va calcolato su 6, non su 8: 4/6 = 67%"
come $O "select * from prove_riassunto(365);"

riga "2. Da dove arrivano. Il passaparola converte meglio dei social."
come $O "select fonte, quante, convertite, conversione from prove_per_fonte(365);"

riga "3. Mese per mese, mesi vuoti compresi"
come $O "select mese, quante, convertite from prove_per_mese(5);"

riga "4. L'elenco: in cima quelle senza esito"
come $O "select quando, fonte, esito from prove_elenco(10);"

riga "5. Segno un esito e il tasso si muove"
SOSPESA=$(psql -X -tAq -c "set role authenticated; set jwt.sub='$O';
  select id from prove_elenco(10) where esito is null limit 1;")
come $O "select segna_esito_prova('$SOSPESA', true);"
echo "   adesso 5 su 7 = 71%"
come $O "select quante, convertite, perse, in_sospeso, conversione from prove_riassunto(365);"

riga "6. Si può tornare indietro: rimetto in sospeso"
come $O "select segna_esito_prova('$SOSPESA', null);"
come $O "select convertite, in_sospeso, conversione from prove_riassunto(365);"

riga "7. Il periodo corto taglia fuori le prove vecchie"
come $O "select quante from prove_riassunto(30);"

riga "8. Una provenienza inventata viene rifiutata"
psql -X -q -c "insert into prenotazioni (sessione_id, profilo_id, stato, prova, prova_fonte)
  values ('eeeeeeee-0000-0000-0000-000000000006', null, 'presente', true, 'tiktokkk');" 2>&1 \
  | grep -o "viola il vincolo\|violates check constraint" | head -1

riga "9. Le due colonne non si possono mettere su un socio"
psql -X -q -c "update prenotazioni set prova_fonte='social'
  where profilo_id is not null;" 2>&1 \
  | grep -o "viola il vincolo\|violates check constraint" | head -1

riga "10. Un socio non vede niente di tutto questo"
come $M1 "select * from prove_riassunto(365);"
come $M1 "select count(*) as righe from prove_elenco(10);"

riga "11. Un coach sì: soci_view ce l'ha di ruolo"
come $LUCA "select quante, convertite, conversione from prove_riassunto(365);"

riga "12. Aggiungere una prova con la provenienza, dalla classe"
SE=eeeeeeee-0000-0000-0000-000000000006
come $LUCA "select aggiungi_prova('$SE', 'amico') is not null as creata;"
come $O "select fonte, esito from prove_elenco(3);"

riepilogo
