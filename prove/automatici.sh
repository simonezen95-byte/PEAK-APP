#!/bin/bash
. "$(dirname "$0")/comune.sh"
# I tre avvisi che partono da soli. La cosa da dimostrare non è che
# partano: è che NON ripartano al controllo successivo.



M1=aaaaaaaa-0000-0000-0000-000000000001
M2=aaaaaaaa-0000-0000-0000-000000000002
M3=aaaaaaaa-0000-0000-0000-000000000003

pulisci() {
  psql -X -q -c "delete from avvisi_mandati; delete from notifiche;
    delete from coda_push; delete from net.chiamate;
    delete from prenotazioni; delete from abbonamenti;
    update profili set certificato_scadenza = null;" >/dev/null
}

# ============================================================
echo
echo "── PROMEMORIA"
pulisci
# Una lezione fra un'ora e mezza, prenotata ieri.
SESS=$(q "insert into sessioni (box_id, data, ora, tipo, nome, capienza)
  select box_id, (now() at time zone 'Europe/Rome' + interval '90 minutes')::date,
         (now() at time zone 'Europe/Rome' + interval '90 minutes')::time,
         'classe', 'Functional', 12 from profili limit 1
  on conflict do nothing returning id;")
psql -X -q -c "
  insert into prenotazioni (sessione_id, profilo_id, prenotato_il)
  values ('$SESS', '$M1', now() - interval '1 day');
  update prenotazioni set stato='prenotato' where sessione_id='$SESS';" >/dev/null

esito "primo giro " "$(q "select avvisi_promemoria();")" "1"
esito "secondo giro" "$(q "select avvisi_promemoria();")" "0"

echo "   · e chi prenota all'ultimo non va disturbato:"
psql -X -q -c "delete from avvisi_mandati; delete from notifiche;
  update prenotazioni set prenotato_il = now() where sessione_id='$SESS';" >/dev/null
esito "prenotata adesso" "$(q "select avvisi_promemoria();")" "0"

echo "   · né chi è in lista d'attesa:"
psql -X -q -c "delete from avvisi_mandati;
  update prenotazioni set prenotato_il = now() - interval '1 day',
    stato = 'lista_attesa' where sessione_id='$SESS';" >/dev/null
esito "lista d'attesa  " "$(q "select avvisi_promemoria();")" "0"

echo "   · né per una lezione annullata:"
psql -X -q -c "delete from avvisi_mandati;
  update prenotazioni set stato='prenotato' where sessione_id='$SESS';
  update sessioni set annullata = true where id='$SESS';" >/dev/null
esito "lezione annullata" "$(q "select avvisi_promemoria();")" "0"

# ============================================================
echo
echo "── ABBONAMENTO IN SCADENZA"
pulisci
psql -X -q -c "
  insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, pagato)
  select '$M1', id, 'abbonamento', current_date - 25, current_date + 3, true
  from pacchetti where nome='Mensile libero';" >/dev/null
esito "primo giro " "$(q "select avvisi_abbonamento();")" "1"
esito "secondo giro" "$(q "select avvisi_abbonamento();")" "0"

echo "   · chi ha già rinnovato non va avvisato:"
pulisci
psql -X -q -c "
  insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, pagato)
  select '$M2', id, 'abbonamento', current_date - 25, current_date + 3, true
  from pacchetti where nome='Mensile libero';
  insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, pagato)
  select '$M2', id, 'abbonamento', current_date + 4, current_date + 34, true
  from pacchetti where nome='Mensile libero';" >/dev/null
esito "già rinnovato" "$(q "select avvisi_abbonamento();")" "0"

echo "   · uno che scade fra venti giorni è troppo presto:"
pulisci
psql -X -q -c "
  insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, pagato)
  select '$M3', id, 'abbonamento', current_date, current_date + 20, true
  from pacchetti where nome='Mensile libero';" >/dev/null
esito "fra venti giorni" "$(q "select avvisi_abbonamento();")" "0"

# ============================================================
echo
echo "── CERTIFICATO IN SCADENZA"
pulisci
psql -X -q -c "update profili set certificato_scadenza = current_date + 10 where id='$M1';" >/dev/null
esito "primo giro " "$(q "select avvisi_certificato();")" "1"
esito "secondo giro" "$(q "select avvisi_certificato();")" "0"

echo "   · porta il certificato nuovo: l'anno prossimo riparte"
psql -X -q -c "update profili set certificato_scadenza = current_date + 365 where id='$M1';" >/dev/null
esito "appena rinnovato" "$(q "select avvisi_certificato();")" "0"
psql -X -q -c "update profili set certificato_scadenza = current_date + 12 where id='$M1';" >/dev/null
esito "fra un anno    " "$(q "select avvisi_certificato();")" "1"

# ============================================================
echo
echo "── TUTTI E TRE INSIEME, E QUANTE SVEGLIE"
pulisci
psql -X -q -c "
  insert into prenotazioni (sessione_id, profilo_id, prenotato_il)
  values ('$SESS', '$M1', now() - interval '1 day');
  update prenotazioni set stato='prenotato' where sessione_id='$SESS';
  update sessioni set annullata = false where id='$SESS';
  insert into abbonamenti (profilo_id, pacchetto_id, tipo, inizio, fine, pagato)
  select '$M2', id, 'abbonamento', current_date - 25, current_date + 3, true
  from pacchetti where nome='Mensile libero';
  update profili set certificato_scadenza = current_date + 10 where id='$M3';" >/dev/null
psql -X -q -c "select * from manda_avvisi_automatici();"
esito "notifiche create" "$(q "select count(*) from notifiche;")" "3"
esito "chiamate al server" "$(q "select count(*) from net.chiamate;")" "1"

echo
echo "── L'OROLOGIO"
psql -X -q -c "select jobname, schedule from cron.job order by jobname;"
echo "   · rieseguendo il file gli orologi non si moltiplicano:"
psql -X -q -v ON_ERROR_STOP=1 -f /home/claude/peak-app/db/32-avvisi-automatici.sql >/dev/null 2>&1
esito "lavori programmati" "$(q "select count(*) from cron.job where jobname like 'peak-%';")" "3"

riepilogo
