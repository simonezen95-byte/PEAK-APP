#!/bin/bash
# Quello che serve a tutte le prove. Si carica con:
#
#     . "$(dirname "$0")/comune.sh"
#
# Dà tre cose: un modo corto per interrogare il database, un modo per
# dire "mi aspetto questo" che tiene il conto, e il conto finale.

export PGHOST=${PGHOST:-/var/run/postgresql}
export PGUSER=${PGUSER:-postgres}
export PGDATABASE=${PGDATABASE:-peak_prove}

# Il conteggio sta in un file e non in una variabile: le prove usano
# i sottoprocessi, e una variabile aumentata dentro un sottoprocesso
# fuori non esiste più.
CONTEGGIO=$(mktemp)
echo "0 0" > "$CONTEGGIO"
trap 'rm -f "$CONTEGGIO"' EXIT

# Una domanda al database, risposta nuda senza intestazioni.
q() { psql -X -tAq -c "$1"; }

# Un comando che non interessa guardare.
muto() { psql -X -q -c "$1" >/dev/null; }

# Una tabella da leggere con gli occhi, non un controllo.
mostra() { psql -X -q -c "$1"; }

# Il controllo vero: nome, cosa è uscito, cosa doveva uscire.
esito() {
  local nome="$1" ottenuto="$2" atteso="$3"
  local ok no; read -r ok no < "$CONTEGGIO"
  if [ "$ottenuto" = "$atteso" ]; then
    printf "   OK   %-34s %s\n" "$nome" "$ottenuto"
    echo "$((ok + 1)) $no" > "$CONTEGGIO"
  else
    printf "   NO   %-34s %s   (atteso %s)\n" "$nome" "$ottenuto" "$atteso"
    echo "$ok $((no + 1))" > "$CONTEGGIO"
  fi
}

titolo() { echo; echo "── $*"; }

# Da chiamare in fondo a ogni prova. Il codice di uscita è quello che
# legge tutte.sh: zero se è andato tutto bene.
riepilogo() {
  local ok no; read -r ok no < "$CONTEGGIO"
  echo
  if [ "$no" -eq 0 ]; then
    echo "   $((ok + no)) controlli, tutti passati."
  else
    echo "   $((ok + no)) controlli: $no FALLITI."
  fi
  [ "$no" -eq 0 ]
}
