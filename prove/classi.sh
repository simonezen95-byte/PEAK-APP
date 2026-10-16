#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sulla gestione di una classe.
OWNER=11111111-1111-1111-1111-111111111111
LUCA=22222222-2222-2222-2222-222222222222   # coach, niente cl_edit
M1=aaaaaaaa-0000-0000-0000-000000000001
M2=aaaaaaaa-0000-0000-0000-000000000002
M3=aaaaaaaa-0000-0000-0000-000000000003
M4=aaaaaaaa-0000-0000-0000-000000000004

come() { psql -X -q -c "set role authenticated; set jwt.sub='$1'; $2"; }
riga() { echo; echo "──── $1"; }

psql -X -tAq -c "set role authenticated; set jwt.sub='$OWNER'; select genera_sessioni(current_date, current_date+14);" >/dev/null
psql -X -q >/dev/null <<SQL
delete from prenotazioni; delete from abbonamenti; delete from notifiche;
insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, totali, pagato)
select id, (select id from pacchetti where nome='Mensile libero'), 'abbonamento',
       current_date-10, current_date+30, null, true
from profili where ruolo='socio';
SQL

# Una classe futura con due posti: due dentro, due in coda.
S=$(psql -X -tAq -c "
  select id from sessioni where tipo='classe'
    and inizio_sessione(data,ora) > now() + interval '2 hours'
  order by data, ora limit 1;")
psql -X -q -c "update sessioni set capienza=2 where id='$S';" >/dev/null
for m in $M1 $M2 $M3 $M4; do
  psql -X -tAq -c "set role authenticated; set jwt.sub='$m';
    insert into prenotazioni (sessione_id, profilo_id) values ('$S','$m');" >/dev/null 2>&1
done
echo "Classe di prova: capienza 2, quattro iscritti"
come $OWNER "select pr.cognome, p.stato, p.posizione_coda
  from prenotazioni p join profili pr on pr.id=p.profilo_id
  where p.sessione_id='$S' order by p.stato, p.posizione_coda, pr.cognome;"

riga "1. Il coach senza cl_edit non annulla"
come $LUCA "select annulla_classe('$S', 'Prova');"

riga "2. Capienza da 2 a 4: i due in coda entrano e vengono avvisati"
come $OWNER "select cambia_capienza('$S', 4) as entrati;"
come $OWNER "select pr.cognome, p.stato from prenotazioni p
  join profili pr on pr.id=p.profilo_id where p.sessione_id='$S' order by pr.cognome;"
psql -X -q -c "select count(*) as avvisi_coda from notifiche where gruppo='lista_attesa';"

riga "3. Stringere sotto il numero degli iscritti: deve rifiutare"
come $OWNER "select cambia_capienza('$S', 2);"

riga "4. Coach: un socio non si può mettere, uno dello staff sì"
come $OWNER "select assegna_coach('$S', '$M1');"
come $OWNER "select assegna_coach('$S', '$LUCA');"
come $OWNER "select coach from attivita_oggi() limit 0;"
psql -X -q -c "select pr.cognome as coach_assegnato from sessioni s
  join profili pr on pr.id=s.coach_id where s.id='$S';"

riga "5. L'elenco dei coach disponibili"
come $OWNER "select cognome, ruolo from elenco_coach();"

riga "6. Annullare: tutti disdetti, tutti avvisati, NESSUNO promosso dalla coda"
come $OWNER "select annulla_classe('$S', 'Il coach è malato.') as avvisati;"
come $OWNER "select pr.cognome, p.stato from prenotazioni p
  join profili pr on pr.id=p.profilo_id where p.sessione_id='$S' order by pr.cognome;"
psql -X -q -c "select pr.cognome, n.titolo, n.testo from notifiche n
  join profili pr on pr.id=n.profilo_id where n.gruppo='classe_annullata' order by pr.cognome limit 2;"
psql -X -q -c "select count(*) as avvisi_coda_totali from notifiche where gruppo='lista_attesa';"

riga "7. Su una classe annullata non si prenota"
psql -X -tAq -c "set role authenticated; set jwt.sub='$M1';
  insert into prenotazioni (sessione_id, profilo_id) values ('$S','$M1');" 2>&1 \
  | grep -o "violates row-level security\|INSERT 0 1" | head -1

riga "8. Annullare due volte: deve rifiutare"
come $OWNER "select annulla_classe('$S');"

riga "9. Riaprire: la lezione torna, le prenotazioni no, e si avvisa"
come $OWNER "select riapri_classe('$S') as avvisati;"
come $OWNER "select pr.cognome, p.stato from prenotazioni p
  join profili pr on pr.id=p.profilo_id where p.sessione_id='$S' order by pr.cognome;"
psql -X -q -c "select distinct n.testo from notifiche n
  where n.gruppo='classe_annullata' and n.titolo like 'Lezione di nuovo%' limit 1;"

riga "10. E adesso si può prenotare di nuovo"
psql -X -tAq -c "set role authenticated; set jwt.sub='$M1';
  insert into prenotazioni (sessione_id, profilo_id) values ('$S','$M1')
  on conflict (sessione_id, profilo_id) do update set stato='prenotato';" 2>&1 \
  | grep -o "violates row-level security\|INSERT 0 1" | head -1

riga "11. Una lezione in più, fuori palinsesto"
come $OWNER "select aggiungi_lezione((current_date + 3)::date, '20:30', 'Seminario kettlebell', 12, 90) is not null as creata;"
come $OWNER "select nome, ora, capienza, durata_min from sessioni
  where data = current_date + 3 and nome like 'Seminario%';"

riga "12. ...ma non nel passato, e non doppia"
come $OWNER "select aggiungi_lezione((current_date - 1)::date, '20:30', 'Tardi', 12, 60);"
come $OWNER "select aggiungi_lezione((current_date + 3)::date, '20:30', 'Doppia', 12, 90);"

riepilogo
