#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Il posto che si libera va al primo della coda che puo prenderlo.
M1=aaaaaaaa-0000-0000-0000-000000000001   # Marco, 2 a settimana, si mette in coda
M2=aaaaaaaa-0000-0000-0000-000000000002   # Giulia, illimitato, seconda in coda
M3=aaaaaaaa-0000-0000-0000-000000000003   # Paolo, occupa il posto e poi disdice
LUCA=22222222-2222-2222-2222-222222222222

psql -X -tAq -c "set role authenticated; set jwt.sub='$LUCA'; select genera_sessioni(current_date, current_date + 14);" >/dev/null
psql -X -q >/dev/null <<SQL
delete from prenotazioni; delete from abbonamenti; delete from notifiche;
insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, totali, pagato) values
  ('$M1', (select id from pacchetti where nome='Mensile 2 a settimana'), 'abbonamento', current_date-10, current_date+30, null, true),
  ('$M2', (select id from pacchetti where nome='Mensile libero'),        'abbonamento', current_date-10, current_date+30, null, true),
  ('$M3', (select id from pacchetti where nome='Mensile libero'),        'abbonamento', current_date-10, current_date+30, null, true);
-- Una classe futura di questa settimana, ridotta a un posto solo.
SQL
PIENA=$(psql -X -tAq -c "
  select id from sessioni
  where tipo='classe' and inizio_sessione(data,ora) > now() + interval '1 hour'
    and data < date_trunc('week', current_date)::date + 7
  order by data, ora limit 1;")
psql -X -q -c "update sessioni set capienza = 1 where id='$PIENA';" >/dev/null
mapfile -t ALTRE < <(psql -X -tAq -c "
  select id from sessioni
  where tipo='classe' and inizio_sessione(data,ora) > now() + interval '1 hour'
    and data < date_trunc('week', current_date)::date + 7 and id <> '$PIENA'
  order by data, ora limit 2;")

prenota() { psql -X -tAq -c "set role authenticated; set jwt.sub='$1';
  insert into prenotazioni (sessione_id, profilo_id) values ('$2','$1');" 2>&1 \
  | grep -o "violates row-level security\|INSERT 0 1" | head -1; }

echo "1. Paolo prende l'unico posto"
echo "   $(prenota $M3 $PIENA)"
echo "2. Marco si mette in coda (non consuma ingressi)"
echo "   $(prenota $M1 $PIENA)"
echo "3. Giulia si mette in coda, seconda"
echo "   $(prenota $M2 $PIENA)"
echo "4. Marco prenota le sue due della settimana: adesso è al tetto"
echo "   $(prenota $M1 ${ALTRE[0]})  $(prenota $M1 ${ALTRE[1]})"
psql -X -q -c "set role authenticated; set jwt.sub='$M1';
  select lezioni_settimana, fatte_in_settimana from mio_accesso();"
echo "5. Paolo disdice. Il posto NON deve andare a Marco, ma a Giulia"
psql -X -q -c "set role authenticated; set jwt.sub='$M3';
  update prenotazioni set stato='disdetta' where profilo_id='$M3' and sessione_id='$PIENA';" >/dev/null
psql -X -q -c "select pr.cognome, p.stato, p.posizione_coda
  from prenotazioni p join profili pr on pr.id=p.profilo_id
  where p.sessione_id='$PIENA' order by pr.cognome;"
echo "6. E la notifica è andata a Giulia, non a Marco"
psql -X -q -c "select pr.cognome, n.titolo from notifiche n
  join profili pr on pr.id=n.profilo_id where n.gruppo='lista_attesa';"

riepilogo
