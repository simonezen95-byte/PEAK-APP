#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Quante volte il database chiama il speditore?
#

LUCA=22222222-2222-2222-2222-222222222222
M1=aaaaaaaa-0000-0000-0000-000000000001
M2=aaaaaaaa-0000-0000-0000-000000000002
M3=aaaaaaaa-0000-0000-0000-000000000003

# Dodici persone con un telefono registrato a testa.
psql -X -q <<SQL
delete from coda_push; delete from push_telefoni; delete from notifiche;
delete from net.chiamate;
insert into push_telefoni (profilo_id, endpoint, p256dh, auth)
select id, 'https://esempio.test/' || id, 'x', 'y'
from profili;
SQL

# Quanti telefoni riceverebbero davvero un 'classe_annullata': non
# tutti i profili, perché qualcuno puo averli spenti dal suo profilo.
ATTESI=$(psql -X -tAq -c "
  select count(*) from push_telefoni t join profili p on p.id = t.profilo_id
  where coalesce((p.notifiche ->> 'classe_annullata')::boolean, true) and t.errori < 5;")
TELEFONI=$(psql -X -tAq -c "select count(*) from push_telefoni;")
echo "   (telefoni registrati: $TELEFONI, di cui $ATTESI vogliono questo avviso)"

conta() { psql -X -tAq -c "select count(*) from net.chiamate;"; }
coda()  { psql -X -tAq -c "select count(*) from coda_push;"; }
azzera(){ psql -X -q -c "delete from net.chiamate; delete from coda_push; delete from notifiche;"; }

echo
echo "── PROVA 1 — tante notifiche con un comando solo"
echo "   (è il caso vero: annullo una lezione piena)"
azzera
psql -X -q -c "
  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select profilo_id, 'classe_annullata', 'Lezione annullata', 'prova'
  from push_telefoni;"
esito "righe in coda" "$(coda)" "$ATTESI"
esito "chiamate   " "$(conta)" "1"

echo
echo "── PROVA 2 — tante notifiche una per volta, nella stessa operazione"
echo "   (è il caso della lista d'attesa, che avvisa uno alla volta)"
azzera
psql -X -q <<SQL
begin;
do \$\$
declare r record;
begin
  for r in select profilo_id from push_telefoni loop
    insert into notifiche (profilo_id, gruppo, titolo, testo)
    values (r.profilo_id, 'classe_annullata', 'Lezione annullata', 'prova');
  end loop;
end \$\$;
commit;
SQL
esito "righe in coda" "$(coda)" "$ATTESI"
esito "chiamate   " "$(conta)" "1"

echo
echo "── PROVA 3 — tante notifiche in operazioni separate"
echo "   (qui una chiamata per volta è giusta: sono fatti diversi)"
azzera
for i in $(seq 1 $TELEFONI); do
  psql -X -q -c "
    insert into notifiche (profilo_id, gruppo, titolo, testo)
    select profilo_id, 'classe_annullata', 'Lezione annullata', 'prova'
    from push_telefoni offset $((i-1)) limit 1;"
done
esito "righe in coda" "$(coda)" "$ATTESI"
esito "chiamate   " "$(conta)" "$TELEFONI"

echo
echo "── PROVA 4 — una conferma di prenotazione, che NON esce dall'app"
azzera
psql -X -q -c "
  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select profilo_id, 'prenotazioni', 'Prenotazione confermata', 'prova'
  from push_telefoni limit 1;"
esito "righe in coda" "$(coda)" "0"
esito "chiamate   " "$(conta)" "0"

echo
echo "── PROVA 5 — operazione annullata a metà: niente deve partire"
azzera
psql -X -q <<SQL
begin;
insert into notifiche (profilo_id, gruppo, titolo, testo)
select profilo_id, 'classe_annullata', 'Lezione annullata', 'prova' from push_telefoni;
rollback;
SQL
esito "righe in coda" "$(coda)" "0"
esito "chiamate   " "$(conta)" "0"

echo
echo "── PROVA 6 — il segno non resta appiccicato fra un'operazione e l'altra"
azzera
psql -X -q -c "
  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select profilo_id, 'classe_annullata', 'A', 'prova' from push_telefoni limit 1;"
psql -X -q -c "
  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select profilo_id, 'classe_annullata', 'B', 'prova' from push_telefoni limit 1;"
esito "chiamate   " "$(conta)" "2"

echo
echo "── PROVA 7 — l'interruttore 'attivo' spento ferma tutto"
azzera
psql -X -q -c "update impostazioni_push set attivo = false;"
psql -X -q -c "
  insert into notifiche (profilo_id, gruppo, titolo, testo)
  select profilo_id, 'classe_annullata', 'C', 'prova' from push_telefoni;"
echo "   la coda si riempie comunque, è solo la chiamata che non parte:"
esito "righe in coda" "$(coda)" "$ATTESI"
esito "chiamate   " "$(conta)" "0"
psql -X -q -c "update impostazioni_push set attivo = true;"

titolo "I PERMESSI DEL SPEDITORE"
# Questo controllo nasce da un difetto vero, trovato in produzione il
# 16 ottobre: avevo chiuso le funzioni del speditore a "public", e in
# PostgreSQL public comprende anche il ruolo con cui lavora la chiave
# segreta del server. Il speditore non poteva chiamare le proprie
# funzioni e rispondeva 403. Nessuna prova se ne sarebbe accorta.
esito "il speditore può prendere la coda" \
  "$(q "select has_function_privilege('service_role','prossime_push(int)','execute');")" "t"
esito "e può chiudere una riga" \
  "$(q "select has_function_privilege('service_role','chiudi_push(bigint,boolean,boolean,text)','execute');")" "t"
esito "un socio non può prendere la coda" \
  "$(q "select has_function_privilege('authenticated','prossime_push(int)','execute');")" "f"
esito "né chiudere una riga" \
  "$(q "select has_function_privilege('authenticated','chiudi_push(bigint,boolean,boolean,text)','execute');")" "f"
esito "né leggere i telefoni altrui" \
  "$(q "select has_table_privilege('authenticated','push_telefoni','insert');")" "f"

riepilogo
