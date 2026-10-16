# Le prove

Servono a sapere se una modifica ha rotto qualcosa, senza doverlo
scoprire da un socio che non riceve un avviso.

Non toccano niente di vero: girano su un database di collaudo che si
chiama `peak_prove`, costruito da zero ogni volta dai file di `db/`.
Supabase non viene mai contattato.

## Farle girare

```
bash prove/tutte.sh            tutte
bash prove/tutte.sh serie      solo quella
```

Alla fine dice quante sono passate. Esce con zero se è andato tutto
bene, così un domani si può attaccare a una pubblicazione automatica.

Serve un PostgreSQL in ascolto in locale. Il banco si rifà da solo
prima di ogni prova — costa due secondi e serve: una prova che passa
solo perché prima ne è girata un'altra non dimostra niente.

## Cosa c'è dentro

| | |
|---|---|
| `tutte.sh` | le fa girare tutte e tiene il conto |
| `ricostruisci.sh` | rifà il banco da zero |
| `comune.sh` | gli aiuti che usano tutte: `q`, `esito`, `riepilogo` |
| `banco/` | quello che su Supabase è un'estensione e qui va finto |

In `banco/` ci sono i sostituti di tre cose che in locale non
esistono: Supabase stesso (`auth.uid()`, i ruoli), `pg_net`, e
`pg_cron`. Il finto `pg_net` non chiama internet: segna una riga, il
che è anche meglio, perché così le chiamate si possono **contare** —
ed è esattamente il difetto da cui siamo partiti, dodici chiamate al
server invece di una.

## Come se ne scrive una

```bash
#!/bin/bash
. "$(dirname "$0")/comune.sh"

titolo "QUELLO CHE STO PROVANDO"
muto "insert into ..."                       # prepara la situazione
esito "cosa mi aspetto" "$(q "select ...")" "1"

riepilogo
```

`esito` prende tre cose: come si chiama il controllo, cosa è uscito,
cosa doveva uscire. Tiene il conto da sé.

Una regola che vale la pena rispettare: **ogni difetto trovato in
produzione diventa una prova.** Quella sui permessi del speditore, in
`sveglia.sh`, nasce così — il 16 ottobre il server rispondeva 403
perché avevo chiuso le sue funzioni a `public`, e in PostgreSQL
`public` comprende anche il ruolo del server. Nessuna prova se ne
sarebbe accorta. Adesso sì.

## Quello che ancora non è controllato

Le prove non sono tutte uguali, e tenerlo nascosto sarebbe peggio che
ammetterlo. `tutte.sh` lo scrive in fondo a ogni esecuzione.

**Controllano da sole** (dicono OK o NO): `sveglia`, `automatici`,
`serie`. Sono le tre più recenti, scritte dopo che questa cartella è
esistita.

**Stampano tabelle da leggere con gli occhi**: `analisi`, `classi`,
`coda`, `economia`, `ingressi`, `presenze`, `prove`, `utenteprova`.
Sono le più vecchie, nate prima che ci fosse un posto dove tenerle.
Le tabelle
che stampano sono giuste e sono state controllate a mano quando sono
state scritte, ma se domani uno di quei numeri cambia non se ne
accorge nessuno.

Vanno convertite, una per volta, scrivendo `esito` al posto delle
tabelle. È il lavoro che resta.

## Una cosa che queste prove non fanno

Provano il database, non l'app. Che una schermata mostri il numero
giusto, che un bottone sia dove uno se lo aspetta, che una scritta non
venga tagliata: quello si vede solo aprendo l'app. Continua a servire
che qualcuno la usi e prema i tasti.
