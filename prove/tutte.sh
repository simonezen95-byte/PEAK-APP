#!/bin/bash
# Tutte le prove, una dopo l'altra, su un banco rifatto da zero
# prima di ognuna.
#
# Rifarlo ogni volta costa due secondi e serve: una prova che passa
# solo perché prima ne è girata un'altra non dimostra niente, e il
# giorno che si scopre è sempre il giorno sbagliato.
#
#     bash prove/tutte.sh            tutte
#     bash prove/tutte.sh serie      solo quella
#
# Esce con zero se è andato tutto bene.

CARTELLA="$(cd "$(dirname "$0")" && pwd)"
export PGHOST=${PGHOST:-/var/run/postgresql}
export PGUSER=${PGUSER:-postgres}
export PGDATABASE=peak_prove

if [ -n "$1" ]; then
  ELENCO="$CARTELLA/$1.sh"
else
  ELENCO=$(ls "$CARTELLA"/*.sh | grep -vE '/(comune|ricostruisci|tutte)\.sh$')
fi

falliti=0
passate=0
controlli=0
soloocchio=

for prova in $ELENCO; do
  nome=$(basename "$prova" .sh)
  printf "\n══════ %s\n" "$nome"

  if ! bash "$CARTELLA/ricostruisci.sh" "$PGDATABASE" >/dev/null 2>&1; then
    echo "   NON SONO RIUSCITO A RIFARE IL BANCO"
    falliti=$((falliti + 1))
    continue
  fi

  uscita=$(bash "$prova" 2>&1)
  codice=$?
  echo "$uscita"

  # Si fallisce per un controllo andato male o per uno script che
  # muore, NON per un "ERROR:" nell'uscita: in parecchie prove
  # l'errore del database è proprio quello che si voleva dimostrare
  # — che una lezione annullata rifiuta le prenotazioni, che un
  # socio non può chiamare una funzione dello staff.
  if echo "$uscita" | grep -q "^   NO " || [ $codice -ne 0 ]; then
    falliti=$((falliti + 1))
  else
    passate=$((passate + 1))
  fi

  # Quanti controlli automatici ha questa prova. Serve a tenere
  # sotto gli occhi quello che ancora non è controllato da solo.
  n=$(echo "$uscita" | sed -n 's/^   \([0-9]\+\) controlli.*/\1/p' | tail -1)
  controlli=$((controlli + ${n:-0}))
  [ "${n:-0}" -eq 0 ] && soloocchio="$soloocchio $nome"
done

echo
echo "═══════════════════════════════════════"
if [ "$falliti" -eq 0 ]; then
  echo "  $passate prove passate, $controlli controlli automatici."
else
  echo "  $passate passate, $falliti FALLITE. ($controlli controlli automatici)"
fi

if [ -n "$soloocchio" ]; then
  echo
  echo "  Da guardare con gli occhi, non ancora controllate da sole:"
  echo "   $soloocchio"
  echo "  Stampano tabelle giuste da leggere, ma se domani un numero"
  echo "  cambia nessuno se ne accorge. Vanno convertite."
fi

[ "$falliti" -eq 0 ]
