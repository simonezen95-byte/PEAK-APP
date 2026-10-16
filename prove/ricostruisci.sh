#!/bin/bash
# Rifà il banco di prova da zero: database vuoto, finto Supabase,
# tutti i file di db/ nell'ordine, finto pg_net, finto pg_cron, e la
# semina di soci e lezioni.
#
# Da zero e non "ripulito": un banco riciclato si porta dietro gli
# avanzi della prova prima, e una prova che passa solo perché prima
# ne è girata un'altra non dimostra niente.
#
# Ci mette un paio di secondi. Non tocca niente di vero: il database
# si chiama peak_prove apposta.
set -e

CARTELLA="$(cd "$(dirname "$0")" && pwd)"
RADICE="$(dirname "$CARTELLA")"

export PGHOST=${PGHOST:-/var/run/postgresql}
export PGUSER=${PGUSER:-postgres}
DB=${1:-peak_prove}

dropdb --if-exists "$DB"
createdb "$DB"

# Prima i sostituti di quello che su Supabase è acceso come
# estensione: i file 31, 32 e 33 li chiamano mentre vengono
# eseguiti, quindi devono esistere già.
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$CARTELLA/banco/00-finto-supabase.sql" >/dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$CARTELLA/banco/02-finto-pg-net.sql"   >/dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$CARTELLA/banco/03-finto-pg-cron.sql"  >/dev/null

# I file veri del progetto, nell'ordine in cui vanno eseguiti anche
# su Supabase. Se uno dà errore ci si ferma qui: è già un difetto.
for f in "$RADICE"/db/*.sql; do
  if ! psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>/tmp/peak-prove-errore; then
    echo "ERRORE eseguendo $(basename "$f"):"
    sed 's/^/   /' /tmp/peak-prove-errore
    exit 1
  fi
done

# I soci, le lezioni e gli abbonamenti finti.
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$CARTELLA/banco/01-semina.sql" >/dev/null

echo "banco pronto: $DB"
