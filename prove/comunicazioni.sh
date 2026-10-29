#!/bin/bash
# Le comunicazioni della palestra.
#
# La cosa da dimostrare non è che si pubblichino: è che i due permessi
# facciano due cose diverse, e che chi non ne ha nessuno resti fuori.
. "$(dirname "$0")/comune.sh"

OWNER=11111111-1111-1111-1111-111111111111   # può tutto
LUCA=22222222-2222-2222-2222-222222222222    # coach
ANNA=33333333-3333-3333-3333-333333333333    # coach
M1=aaaaaaaa-0000-0000-0000-000000000001      # socio

come() { psql -X -tAq -c "set role authenticated; set jwt.sub='$1'; $2" 2>&1 | tail -1; }

# Per un errore non serve l'ultima riga — quella è il contesto della
# funzione — ma la frase che il database solleva. Si cerca in tutta
# l'uscita, non in fondo.
errore() {
  psql -X -tAq -c "set role authenticated; set jwt.sub='$1'; $2" 2>&1 \
    | grep -oiE "non puoi [a-zà ]+|serve un [a-z]+|bacheca ma non [a-z ]+" | head -1
}

# Permessi su misura: Luca solo la bacheca, Anna solo gli avvisi.
muto "update profili set permessi = '{\"com_board\": true}'::jsonb where id = '$LUCA';
      update profili set permessi = '{\"com_send\": true}'::jsonb  where id = '$ANNA';
      delete from comunicazioni; delete from notifiche; delete from coda_push;
      delete from net.chiamate; delete from attivita;"

titolo "CHI PUÒ SCRIVERE IN BACHECA"
esito "il titolare" \
  "$(come $OWNER "select pubblica_comunicazione('Chiusura 1 novembre','Il box resta chiuso.') is not null;")" "t"
esito "chi ha la bacheca" \
  "$(come $LUCA  "select pubblica_comunicazione('Nuovo rack','Arrivato il rack nuovo.') is not null;")" "t"
esito "chi ha gli avvisi" \
  "$(come $ANNA  "select pubblica_comunicazione('Orario ridotto','Sabato si chiude alle 12.') is not null;")" "t"
esito "un socio no" \
  "$(errore $M1  "select pubblica_comunicazione('Prova','Prova');")" "Non puoi pubblicare comunicazioni"

titolo "CHI PUÒ FAR SQUILLARE I TELEFONI"
esito "chi ha solo la bacheca non può" \
  "$(errore $LUCA "select pubblica_comunicazione('Prova','Prova','comunicazione',true);")" "bacheca ma non mandare avvisi sul telefono"
esito "chi ha gli avvisi sì" \
  "$(come $ANNA "select pubblica_comunicazione('Chiuso per neve','Oggi il box resta chiuso.','avviso',true) is not null;")" "t"

titolo "A CHI È ARRIVATA"
mostra "select pr.cognome, n.titolo from notifiche n
        join profili pr on pr.id = n.profilo_id
        where n.gruppo='comunicazione' order by pr.cognome;"
# Tutti gli approvati tranne chi l'ha scritta.
ATTESI=$(q "select count(*) from profili where stato='approvato' and id <> '$ANNA';")
esito "quante notifiche    " "$(q "select count(*) from notifiche where gruppo='comunicazione';")" "$ATTESI"
esito "non a chi l'ha scritta" \
  "$(q "select count(*) from notifiche where gruppo='comunicazione' and profilo_id='$ANNA';")" "0"
esito "segnato sulla riga  " \
  "$(q "select avvisati from comunicazioni where titolo='Chiuso per neve';")" "$ATTESI"
esito "una sveglia sola    " "$(q "select count(*) from net.chiamate;")" "1"

titolo "QUELLE SENZA AVVISO RESTANO IN BACHECA"
esito "avvisati a zero" \
  "$(q "select avvisati from comunicazioni where titolo='Chiusura 1 novembre';")" "0"

titolo "QUELLO CHE NON SI ACCETTA"
esito "titolo vuoto" "$(errore $OWNER "select pubblica_comunicazione('   ','Testo');")" "Serve un titolo"
esito "testo vuoto " "$(errore $OWNER "select pubblica_comunicazione('Titolo','  ');")" "Serve un testo"

titolo "L'ELENCO PER LA CONSOLE"
mostra "set role authenticated; set jwt.sub='$OWNER';
        select titolo, autore, avvisati from comunicazioni_elenco(10);"
esito "quante ne vede il titolare" \
  "$(come $OWNER "select count(*) from comunicazioni_elenco(10);")" "$(q "select count(*) from comunicazioni;")"
esito "un socio non vede l'elenco" "$(come $M1 "select count(*) from comunicazioni_elenco(10);")" "0"

titolo "QUANTI NE RAGGIUNGEREI"
mostra "set role authenticated; set jwt.sub='$OWNER'; select * from quanti_avviserei();"

titolo "TOGLIERE"
COM=$(q "select id from comunicazioni where titolo='Nuovo rack';")
esito "un socio non può" "$(errore $M1 "select togli_comunicazione('$COM');")" "Non puoi togliere questa comunicazione"
come $OWNER "select togli_comunicazione('$COM');" >/dev/null
esito "tolta dalla bacheca" "$(q "select count(*) from comunicazioni where id='$COM';")" "0"
esito "ma scritta nel registro" \
  "$(q "select count(*) from attivita where azione='comunicazione_tolta' and dettaglio->>'titolo'='Nuovo rack';")" "1"
esito "e il testo è conservato" \
  "$(q "select dettaglio->>'testo' from attivita where azione='comunicazione_tolta';")" "Arrivato il rack nuovo."

riepilogo
