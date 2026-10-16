#!/bin/bash
. "$(dirname "$0")/comune.sh"
# L'avviso "non interrompere la serie". Le cose da dimostrare sono
# soprattutto negative: a chi NON deve arrivare.


M1=aaaaaaaa-0000-0000-0000-000000000001   # serie lunga, fermo questa settimana
M2=aaaaaaaa-0000-0000-0000-000000000002   # serie lunga ma si è già allenato
M3=aaaaaaaa-0000-0000-0000-000000000003   # fermo da un mese: nessuna serie
M4=aaaaaaaa-0000-0000-0000-000000000004   # serie lunga ma abbonamento scaduto

SESSIONE_IN() {  # crea una sessione passata e ci mette dentro una presenza
  local chi=$1 giorni=$2
  local s
  s=$(q "insert into sessioni (box_id, data, ora, tipo, nome, capienza)
         select box_id, current_date - $giorni, '18:00', 'classe', 'Functional', 20
         from profili limit 1
         on conflict (box_id, data, ora, tipo) do update set capienza = excluded.capienza
         returning id;")
  psql -X -q -c "
    insert into prenotazioni (sessione_id, profilo_id, prenotato_il)
    values ('$s', '$chi', now() - interval '$giorni days')
    on conflict do nothing;
    update prenotazioni set stato='presente'
    where sessione_id='$s' and profilo_id='$chi';" >/dev/null
}

echo
echo "── Preparo il banco"
psql -X -q -c "
  delete from avvisi_mandati; delete from notifiche; delete from coda_push;
  delete from net.chiamate; delete from prenotazioni; delete from abbonamenti;
  delete from quote;
  update profili set certificato_scadenza = current_date + 200;
  insert into quote (profilo_id, anno_sportivo)
  select id, extract(year from current_date)::int + 1 from profili;
  insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, pagato)
  select p.id, k.id, 'abbonamento', current_date - 30, current_date + 30, true
  from profili p cross join (select id from pacchetti where nome='Mensile libero') k;" >/dev/null

# M1: allenato nelle ultime quattro settimane passate, fermo in questa
for g in 7 14 21 28; do SESSIONE_IN $M1 $g; done
# M2: come M1 ma si è allenato anche in questa settimana
for g in 7 14 21 28; do SESSIONE_IN $M2 $g; done
SESSIONE_IN $M2 0
# M3: solo una volta, cinque settimane fa
SESSIONE_IN $M3 35
# M4: come M1, ma gli togliamo l'abbonamento
for g in 7 14 21 28; do SESSIONE_IN $M4 $g; done
psql -X -q -c "delete from abbonamenti where profilo_id='$M4';" >/dev/null

echo
echo "── CHI LA RICEVE"
psql -X -q -c "
  select pr.cognome, s.settimane
  from serie_a_rischio() s join profili pr on pr.id = s.profilo_id
  order by pr.cognome;"

esito "quanti in tutto      " "$(q "select count(*) from serie_a_rischio();")" "1"
esito "è Alfa (serie 4)     " "$(q "select settimane from serie_a_rischio();")" "4"
esito "Beta no, si è allenato" "$(q "select count(*) from serie_a_rischio() where profilo_id='$M2';")" "0"
esito "Gamma no, nessuna serie" "$(q "select count(*) from serie_a_rischio() where profilo_id='$M3';")" "0"
esito "Delta no, non può entrare" "$(q "select count(*) from serie_a_rischio() where profilo_id='$M4';")" "0"

echo
echo "── NON SI RIPETE"
esito "primo giro " "$(q "select avvisi_serie();")" "1"
esito "secondo giro" "$(q "select avvisi_serie();")" "0"

echo
echo "── IL TESTO CHE ARRIVA"
psql -X -q -c "select titolo, testo from notifiche where gruppo='serie';"

echo "── ed è finito in coda col gruppo suo:"
psql -X -q -c "select gruppo, count(*) from coda_push group by gruppo;"

echo
echo "── SENZA CERTIFICATO VALIDO NON SI SPINGE NESSUNO"
psql -X -q -c "delete from avvisi_mandati;
  update profili set certificato_scadenza = current_date - 1 where id='$M1';" >/dev/null
esito "certificato scaduto" "$(q "select count(*) from serie_a_rischio();")" "0"
psql -X -q -c "update profili set certificato_scadenza = current_date + 200 where id='$M1';" >/dev/null

echo "── E SENZA QUOTA NEMMENO"
psql -X -q -c "delete from quote where profilo_id='$M1';" >/dev/null
esito "quota non versata  " "$(q "select count(*) from serie_a_rischio();")" "0"

riepilogo
