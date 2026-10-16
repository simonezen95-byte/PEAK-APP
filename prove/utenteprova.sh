#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sull'utente prova.
OWNER=11111111-1111-1111-1111-111111111111
LUCA=22222222-2222-2222-2222-222222222222
M1=aaaaaaaa-0000-0000-0000-000000000001
M2=aaaaaaaa-0000-0000-0000-000000000002
M3=aaaaaaaa-0000-0000-0000-000000000003
M4=aaaaaaaa-0000-0000-0000-000000000004
SA=cccccccc-0000-0000-0000-00000000000a   # ieri 18:00, coach Luca, capienza 3
SC=cccccccc-0000-0000-0000-00000000000c   # oggi 06:30, coach Luca, capienza 3

come() { psql -X -q -c "set role authenticated; set jwt.sub='$1'; $2"; }
riga() { echo; echo "──── $1"; }

riga "1. Un socio non può aggiungere prove"
come $M1 "select aggiungi_prova('$SC');"

riga "2. Il coach ne aggiunge due alla classe di stamattina (1 su 3)"
come $LUCA "select aggiungi_prova('$SC') is not null as prima;"
come $LUCA "select aggiungi_prova('$SC') is not null as seconda;"
come $LUCA "select cognome, nome, stato, prova from elenco_presenze('$SC');"

riga "3. Adesso la classe è piena (3 su 3): la terza prova deve rifiutare"
come $LUCA "select aggiungi_prova('$SC');"

riga "4. Due prove nella stessa classe non si pestano i piedi"
psql -X -q -c "select count(*) as righe_prova from prenotazioni where prova;"

riga "5. La prova NON entra nelle statistiche di nessun socio"
come $M1 "select questo_mese, totale from miei_allenamenti();"
psql -X -q -c "select count(*) as righe_senza_socio from prenotazioni where profilo_id is null;"

riga "6. Confermare le presenze adesso va per righe: spunto Marco e una prova"
MARCO=$(psql -X -tAq -c "set role authenticated; set jwt.sub='$LUCA';
  select prenotazione_id from elenco_presenze('$SC') where profilo_id='$M1';")
UNAPROVA=$(psql -X -tAq -c "set role authenticated; set jwt.sub='$LUCA';
  select prenotazione_id from elenco_presenze('$SC') where prova limit 1;")
come $LUCA "select segna_presenze('$SC', array['$MARCO','$UNAPROVA']::uuid[]) as presenti;"
come $LUCA "select cognome, nome, stato, prova from elenco_presenze('$SC');"

riga "7. Quante prove questo mese: una sola, quella confermata"
come $OWNER "select quante_prove(date_trunc('month', current_date)::date, current_date) as prove;"

riga "8. Marco risulta allenato, la prova non risulta a nessuno"
come $M1 "select questo_mese, settimana_fatta from miei_allenamenti();"

riga "9. Togliere una prova la cancella; togliere un socio lo disdice"
come $LUCA "select togli_riga('$UNAPROVA');"
come $LUCA "select togli_riga('$MARCO');"
come $LUCA "select cognome, nome, stato, prova from elenco_presenze('$SC');"
psql -X -q -c "select stato, prova from prenotazioni where sessione_id='$SC' order by prova;"

riga "10. Il vincolo regge: una riga non può essere prova e socio insieme"
psql -X -q -c "insert into prenotazioni (sessione_id, profilo_id, prova)
  values ('$SC', '$M2', true);" 2>&1 | grep -o "viola il vincolo\|violates check constraint" | head -1

riga "11. ...né senza nessuno dei due"
psql -X -q -c "insert into prenotazioni (sessione_id, profilo_id, prova)
  values ('$SC', null, false);" 2>&1 | grep -o "viola il vincolo\|violates check constraint" | head -1

riga "12. Su una lezione annullata non si aggiungono prove"
come $OWNER "select annulla_classe('$SA', 'Prova');" >/dev/null
come $LUCA "select aggiungi_prova('$SA');"

riepilogo
