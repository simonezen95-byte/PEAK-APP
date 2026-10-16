#!/bin/bash
. "$(dirname "$0")/comune.sh"
# Prove sulle presenze, nell'ordine giusto: prima le prove sulle
# classi ancora aperte, poi la chiusura, poi i numeri dei soci.
OWNER=11111111-1111-1111-1111-111111111111
LUCA=22222222-2222-2222-2222-222222222222
ANNA=33333333-3333-3333-3333-333333333333
M1=aaaaaaaa-0000-0000-0000-000000000001   # Marco
M2=aaaaaaaa-0000-0000-0000-000000000002   # Giulia
M3=aaaaaaaa-0000-0000-0000-000000000003   # Paolo
M4=aaaaaaaa-0000-0000-0000-000000000004   # Sara (in coda)
SA=cccccccc-0000-0000-0000-00000000000a   # ieri 18:00, coach Luca, piena 3/3 + 1 in coda
SB=cccccccc-0000-0000-0000-00000000000b   # ieri 19:00, coach Anna, vuota
SC=cccccccc-0000-0000-0000-00000000000c   # oggi 06:30, coach Luca, 1 prenotato

come() { psql -X -q -c "set role authenticated; set jwt.sub = '$1'; $2"; }
riga() { echo; echo "──── $1"; }

riga "1. Luca (coach) vede solo le classi che tiene lui"
come $LUCA "select data, ora, coach, iscritti from classi_da_chiudere();"

riga "2. Anna vede solo la sua, l'owner tutte e tre"
come $ANNA "select count(*) as per_anna from classi_da_chiudere();"
come $OWNER "select count(*) as per_owner from classi_da_chiudere();"

riga "3. Luca può chiudere la sua, non quella di Anna; il socio niente"
come $LUCA "select posso_chiudere('$SA') as mia, posso_chiudere('$SB') as di_anna;"
come $M1 "select posso_chiudere('$SA') as socio;"

riga "4. L'elenco da spuntare: 3 prenotati, poi la coda in fondo"
come $LUCA "select cognome, stato, posizione_coda from elenco_presenze('$SA');"
come $M1 "select count(*) as visto_dal_socio from elenco_presenze('$SA');"

riga "5. Walk-in su classe PIENA (3 su 3): deve rifiutare"
come $LUCA "select aggiungi_alla_classe('$SA', '$M4');"

riga "6. Walk-in sulla classe di stamattina (1 su 3): entra, segnato presente"
come $LUCA "select aggiungi_alla_classe('$SC', '$M4');"
come $LUCA "select cognome, stato, walk_in from elenco_presenze('$SC');"

riga "7. Togliere qualcuno dalla classe di ieri NON deve promuovere la coda"
come $LUCA "select togli_dalla_classe('$SA', '$M3');"
come $LUCA "select cognome, stato, posizione_coda from elenco_presenze('$SA');"
psql -X -tAc "select count(*) as notifiche_mandate from notifiche where gruppo='lista_attesa';"
come $LUCA "select aggiungi_alla_classe('$SA', '$M3');"

riga "8. Anna prova a chiudere la classe di Luca: deve rifiutare"
come $ANNA "select segna_presenze('$SA', array['$M1']::uuid[]);"

riga "9. Luca chiude: c'erano Marco e Paolo, Giulia no"
come $LUCA "select segna_presenze('$SA', array['$M1','$M3']::uuid[]) as presenti;"
come $LUCA "select cognome, stato from elenco_presenze('$SA');"
psql -X -tAc "select presenze_confermate_da is not null as firmata, presenze_confermate_il is not null as datata from sessioni where id='$SA';"

riga "10. La classe chiusa sparisce dall'elenco"
come $LUCA "select data, ora from classi_da_chiudere();"

riga "11. Marco: una presenza confermata ieri. Oggi ha prenotato le 6:30, non ancora confermate"
come $M1 "select questo_mese, mese_scorso, settimane_di_fila, settimana_fatta, in_programma, totale, dal from miei_allenamenti();"

riga "12. Giulia, segnata assente: tutto a zero"
come $M2 "select questo_mese, settimane_di_fila, settimana_fatta, totale from miei_allenamenti();"

riga "13. Sara, walk-in presente stamattina: una presenza, settimana in corso alimentata"
come $M4 "select questo_mese, settimane_di_fila, settimana_fatta, totale from miei_allenamenti();"

riga "14. Le settimane di Marco: fatta quella scorsa, non quella in corso"
come $M1 "select to_char(inizio,'DD/MM') as dal, fatta, quanti, in_corso from mie_settimane(3);"

riga "15. Le settimane di Sara: fatta quella in corso"
come $M4 "select to_char(inizio,'DD/MM') as dal, fatta, quanti, in_corso from mie_settimane(3);"

riga "16. Chiudere una classe senza nessun presente"
come $ANNA "select segna_presenze('$SB', array[]::uuid[]) as presenti;"

riepilogo
