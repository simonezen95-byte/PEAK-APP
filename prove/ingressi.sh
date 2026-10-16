#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sugli ingressi: i quattro tipi di pacchetto.
M1=aaaaaaaa-0000-0000-0000-000000000001   # Marco  -> 2 a settimana
M2=aaaaaaaa-0000-0000-0000-000000000002   # Giulia -> 8 ingressi
M3=aaaaaaaa-0000-0000-0000-000000000003   # Paolo  -> illimitato
M4=aaaaaaaa-0000-0000-0000-000000000004   # Sara   -> solo Open Box
LUCA=22222222-2222-2222-2222-222222222222

come() { psql -X -q -c "set role authenticated; set jwt.sub = '$1'; $2"; }
riga() { echo; echo "──── $1"; }

# Materializzo due settimane di sessioni dal palinsesto.
# genera_sessioni vuole un socio approvato: la chiamo come Luca.
psql -X -tAq -c "set role authenticated; set jwt.sub='$LUCA'; select genera_sessioni(current_date, current_date + 14);" >/dev/null

# Rimetto a posto gli abbonamenti: uno per tipo.
psql -X -q >/dev/null <<SQL
delete from prenotazioni;
delete from abbonamenti;
insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, totali, pagato) values
  ('$M1', (select id from pacchetti where nome='Mensile 2 a settimana'),  'abbonamento', current_date-10, current_date+30, null, true),
  ('$M2', (select id from pacchetti where nome='Mensile 8 ingressi'),     'abbonamento', current_date-10, current_date+30, 8,    true),
  ('$M3', (select id from pacchetti where nome='Mensile libero'),         'abbonamento', current_date-10, current_date+30, null, true),
  ('$M4', (select id from pacchetti where nome='Solo Open Box'),          'abbonamento', current_date-10, current_date+30, null, true);
SQL

# Le prossime classi future, una per giorno.
mapfile -t CLASSI < <(psql -X -tAq -c "
  select id from sessioni
  where tipo='classe' and inizio_sessione(data,ora) > now() + interval '1 hour'
    and data < date_trunc('week', current_date)::date + 7
  order by data, ora limit 6;")
mapfile -t PROSSIMA < <(psql -X -tAq -c "
  select id from sessioni
  where tipo='classe' and data >= date_trunc('week', current_date)::date + 7
  order by data, ora limit 3;")
mapfile -t OPENBOX < <(psql -X -tAq -c "
  select id from sessioni
  where tipo='openbox' and inizio_sessione(data,ora) > now() + interval '1 hour'
  order by data, ora limit 2;")

echo "Classi questa settimana: ${#CLASSI[@]} · settimana prossima: ${#PROSSIMA[@]} · open box: ${#OPENBOX[@]}"

prenota() { # prenota <socio> <sessione>
  psql -X -tAq -c "set role authenticated; set jwt.sub='$1';
    insert into prenotazioni (sessione_id, profilo_id) values ('$2','$1');" 2>&1 \
    | grep -o "new row violates row-level security\|INSERT 0 1" | head -1
}

riga "1. MARCO, due a settimana. Le prime due passano, la terza no"
for i in 0 1 2; do echo "  classe $((i+1)): $(prenota $M1 ${CLASSI[$i]})"; done

riga "2. ...ma la settimana prossima riparte da zero"
echo "  settimana prossima: $(prenota $M1 ${PROSSIMA[0]})"

riga "3. Cosa vede Marco"
come $M1 "select abbonamento, residui, lezioni_settimana, fatte_in_settimana from mio_accesso();"

riga "4. Se disdice una di questa settimana, il posto torna libero"
psql -X -q -c "set role authenticated; set jwt.sub='$M1';
  update prenotazioni set stato='disdetta' where profilo_id='$M1' and sessione_id='${CLASSI[0]}';" >/dev/null
echo "  terza classe, dopo la disdetta: $(prenota $M1 ${CLASSI[2]})"

riga "5. GIULIA, otto ingressi: ne prenota otto, il nono no"
mapfile -t TUTTE < <(psql -X -tAq -c "
  select id from sessioni
  where tipo='classe' and inizio_sessione(data,ora) > now() + interval '1 hour'
  order by data, ora limit 9;")
for i in $(seq 0 8); do
  echo "  $((i+1)): $(prenota $M2 ${TUTTE[$i]})  residui: $(psql -X -tAq -c "set role authenticated; set jwt.sub='$M2'; select residui from mio_accesso();")"
done

riga "6. Un'assenza non consuma: se la prima risulta assente, un ingresso torna"
psql -X -q -c "update prenotazioni set stato='assente'
  where profilo_id='$M2' and sessione_id='${TUTTE[0]}';" >/dev/null
come $M2 "select residui from mio_accesso();"
echo "  nono, adesso: $(prenota $M2 ${TUTTE[8]})"

riga "7. PAOLO, illimitato: nessun numero da mostrare, nessun tetto"
for i in 0 1 2 3; do echo "  classe $((i+1)): $(prenota $M3 ${CLASSI[$i]})"; done
come $M3 "select abbonamento, residui, lezioni_settimana from mio_accesso();"

riga "8. SARA, solo Open Box: la classe no, l'Open Box sì"
echo "  classe:   $(prenota $M4 ${CLASSI[0]})"
echo "  open box: $(prenota $M4 ${OPENBOX[0]})"

riga "9. L'Open Box non consuma ingressi: Giulia ne prenota uno e i residui non cambiano"
come $M2 "select residui as prima from mio_accesso();"
echo "  open box: $(prenota $M2 ${OPENBOX[0]})"
come $M2 "select residui as dopo from mio_accesso();"

riga "10. In reception: chi è in regola e con quanti ingressi"
come $LUCA "select cognome, abbonamento, residui, in_regola from soci_elenco() where ruolo='socio';"

riepilogo
