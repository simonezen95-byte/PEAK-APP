# PEAK — istruzioni per Claude

Questo file lo legge Claude all'inizio di ogni sessione, sia in Claude
Code sia nella chat del Progetto PEAK su claude.ai. Contiene il contesto
che non si ricava dal codice: chi decide, come si lavora, perché le cose
sono fatte così. **Il registro in fondo si aggiorna a fine sessione.**

---

## Cos'è

L'app di **PEAK Functional Fitness A.S.D.**, box di functional fitness in
Via Enrico Mattei 18, Maser (TV). Apertura prevista gennaio 2027.

Due facce nello stesso codice:

- **lato socio** — prenotare, vedere il WOD, segnare risultati e
  massimali, seguire i propri progressi;
- **console staff** — segreteria (soci, abbonamenti, classi, presenze)
  e analisi.

Fondatori e admin: **Simone** (coach, sviluppa l'app), **Giulio**
(coach), **Alberto** (fisioterapista), **Filippo** (commercialista,
amministrazione). Simone dirige e rivede; Claude scrive il codice.

## Dove vive

| Cosa | Dove |
|---|---|
| App | `peak-app-weld.vercel.app` (Vercel, piano Hobby) |
| Schermo in sala | `peak-app-weld.vercel.app/tv/peak` |
| Codice | GitHub `simonezen95-byte/PEAK-APP`, ramo `main` |
| Database | Supabase, progetto `iwmrkbgrnnkeiqdkvqrb`, regione Europa |
| Sito pubblico | `peakfunctionalfitness.it`, repo separato `Peak-Landing` |

Ogni commit su `main` viene ripubblicato da Vercel in un paio di minuti.
Le modifiche al database si eseguono a mano nell'editor SQL di Supabase.

## Struttura

```
src/
  App.jsx            decide quale schermata mostrare
  schermate/         una schermata per file
  ui/                pezzi riusabili (base.jsx: Card, Titolo, Sezione…)
  lib/               logica e chiamate al database, una per argomento
api/                 lo speditore delle notifiche push (unico pezzo su server)
public/sw.js         riceve le notifiche sul telefono
db/                  file SQL numerati, da eseguire in ordine, rieseguibili
prove/               prove del database su PostgreSQL locale (vedi LEGGIMI.md)
prototipi/           prototipi di settembre, solo storico
```

Stack: React 18 + Vite + Tailwind, Supabase, `lucide-react` per le icone.
Quattro dipendenze in tutto: aggiungerne una va motivato.

---

## Come lavora Simone

- **Una schermata alla volta.** Niente modifiche grosse in blocco.
- **Prima si discute, poi si costruisce.** Se Simone sta ragionando su
  un'idea futura, non si tocca niente finché non dice di procedere.
- **Risposte brevi e dirette.** Verificare prima di affermare: se il
  ragionamento è debole, Simone lo contesta.
- **Lavora spesso da iPhone.** Per un file SQL da eseguire su Supabase
  serve il link al testo grezzo, non la pagina di GitHub:
  `https://raw.githubusercontent.com/simonezen95-byte/PEAK-APP/main/db/<file>`
- **Costi: ogni voce si giustifica da sola.** Gratis o quasi finché si
  può; si paga solo quello che richiede davvero un esterno.
- **Vuole i numeri sotto controllo**, come nel gestionale Decathlon
  (Mobi) da cui viene. Agli altri soci interessano meno: la console non
  deve diventare illeggibile per loro.

## Scritte nell'app

- **Tono da gestionale professionale.** Niente frasi rivolte a Simone o
  colloquiali: le leggono anche gli altri admin e i soci.
- **Italiano**; l'inglese solo per etichette di marchio
  (*Find your peak*, *focus, train, improve, repeat*).
- Frasi brevi, numeri concreti al posto degli aggettivi, niente
  superlativi né punti esclamativi (eccezione voluta: l'avviso serie).
- **Mai "CrossFit"**: si dice "Functional".
- **"Socio"** dove si parla dell'associazione (quota, registrazione,
  privacy, anagrafica, economia): è la forma giuridica dell'ASD e deve
  restare. Sull'uso di "Atleta" nell'allenamento: vedi decisioni aperte.

## Grafica

- Sfondo nero, font **Barlow** e **Montserrat**.
- Token per superfici: `fondo`, `scheda`, `bordo`, `rilievo`, `filo`.
- Scala di neri e grigi **uguale al sito** (Tailwind "neutral"):
  fondo `#0A0A0A`, scheda `#171717`, bordo e filo `#262626`, rilievo
  `#1F1F1F`.
- Token per testo (**usare questi, mai `text-neutral-*` a mano**):

  | Token | Colore | Uso | Contrasto in scheda |
  |---|---|---|---|
  | `etichetta` | `#A3A3A3` | nomi di sezione e di campo | 7.1:1 |
  | `dettaglio` | `#8A8A8A` | date, unità, quantità | 5.2:1 |
  | `spento` | `#8A8A8A` | presente ma secondario | 5.2:1 |

- Testo mai sotto **10 px**. Fatto sulla Home; le altre schermate
  vanno portate una alla volta.
- Ogni cosa toccabile almeno **44×44**. Ogni schermata ha un titolo
  vero (`<h1>`/`<h2>` da `Titolo` e `Sezione`). Rispettare
  `prefers-reduced-motion`.
- Deve reggere a **320 px** (iPhone SE) senza scorrimento orizzontale.
- Misure del segno della montagna: `PEAK-segno-montagna.md` nel
  Progetto.

---

## Regole tecniche da non rompere

1. **Le regole stanno nel database, non nell'app.** La chiave Supabase
   nel browser è pubblica: chiunque abbia un account può interrogare il
   database senza passare dalle schermate. Un controllo che vive solo in
   React si salta.
2. **Ogni file `db/` si prova in locale prima di Supabase**
   (`bash prove/tutte.sh`). Ogni difetto trovato in produzione diventa
   una prova.
3. **Prima di caricare, tre controlli**: compila, nessun errore, e
   nessun nome usato senza essere importato (uno schermo nero l'ha
   insegnato: non è un errore di compilazione).
4. **Una modifica che si vede si disegna e si misura prima** di
   caricarla, a 390 e 320 px. Non si usa Simone come schermo di prova.
5. **Fuso orario**: ogni confronto con l'orologio passa da
   `inizio_sessione(data, ora)`. Il database ragiona in UTC.
6. **Non si scala, si conta.** Gli ingressi usati si ricontano dalle
   prenotazioni ogni volta; nessun contatore da decrementare.
7. **Un pacchetto non si cancella, si spegne.** Gli abbonamenti venduti
   puntano lì.
8. **`soci_pubblici` resta SECURITY DEFINER.** Il pannello Supabase
   suggerisce `security_invoker`: romperebbe i nomi nelle classi. La
   vista richiede l'approvazione dello staff.
9. **Togliere un permesso a `public` lo toglie anche a `service_role`.**
   Va ridato per nome (prova in `prove/sveglia.sh`).
10. **Nessun segreto nei file.** Il repo è pubblico. Le chiavi stanno
    nelle variabili di Vercel; la parola d'ordine delle push si mette a
    mano con un `update impostazioni_push`. La chiave VAPID privata vive
    solo su Vercel: se si perde, tutti i telefoni vanno ri-registrati.
11. **Supabase → Authentication → Email: conferma email spenta.** Il
    controllo vero è l'approvazione in reception.
12. **`box_id` c'è su tutti gli archivi** anche se oggi la palestra è
    una sola: non toglierlo.

---

## Come funziona (decisioni prese)

**Staff e socio.** La console staff è amministrazione: segreteria e
analisi. Il lato socio è dove uno fa cose per sé. L'eccezione accettata
è scrivere il WOD, che sta nella console. Lo switch Titolare/Socio
toglie davvero i poteri.

**Classi.** 60 minuti, massimo 15. Open Box 60 minuti, massimo 10.
Prenotazioni aperte 7 giorni prima, disdetta fino a 15 minuti prima,
nessuna penale.

**Presenze.** La lezione vale quando il coach la conferma. Lista
iscritti senza spunte, si spunta chi c'è. Un coach chiude solo le sue
classi. Chi arriva senza prenotazione si aggiunge se c'è posto. Le
statistiche contano solo presenze confermate. Nessun check-in QR.

**No-show.** Registrato, non costa ingressi, nessun blocco.

**Ingressi.** Quattro forme di pacchetto: illimitato, a ingressi, a
settimana (si azzera il lunedì), solo Open Box. Consumano un ingresso:
presenza confermata e prenotazione futura. Non consumano: assenze,
lista d'attesa, disdette, lezioni annullate, Open Box.

**Lista d'attesa.** Il posto liberato va al primo della coda che può
davvero prenderlo (rispetta il tetto settimanale).

**Annullare una lezione.** Segna, disdice tutte le prenotazioni, avvisa
— in quest'ordine. Riaprire non rimette dentro nessuno.

**WOD.** Pubblicazione immediata. RX obbligatoria, Scaled e Open
facoltative. Movimenti come righe di testo libero. Il warm-up va solo
sulla TV, non nell'app del socio. I coach di default non modificano il
WOD.

**Abbonamento omaggio.** Pacchetto a 0 € dal Listino. La quota
associativa resta dovuta.

**Utente prova.** Stato a sé, non entra nei conti dei soci.

**Certificato medico.** Consegnato su carta; l'app tiene solo la data.

**Pagamenti.** In sede (bonifico prima scelta, SumUp per casi
particolari). Nessun processore integrato per ora.

**Notifiche push.** Escono: lista d'attesa, lezione annullata,
promemoria (2 ore prima), abbonamento (5 giorni), certificato (15
giorni), serie (giovedì 10:00), comunicazioni. Non escono: conferme di
prenotazione, nuovo WOD, risultato del compagno. Dettagli nel Progetto:
`PEAK-notifiche-push.md`.

---

## Decisioni aperte

- **"Atleta" o "Socio"** nelle parti di allenamento. Proposta sul
  tavolo: atleta per allenamento, socio per associazione. Circa 200
  scritte; i nomi nel database non si toccano. Più si aspetta, più
  costa.
- **Omaggi in contabilità**: vanno etichettati a parte? Da chiedere a
  Filippo.
- **Utente prova**: un coach può aggiungerlo solo nelle sue classi o
  ovunque?
- **Certificato per una prova singola**: serve o basta
  un'autocertificazione?
- **Avviso serie il giovedì**: da rivedere col palinsesto definitivo.

## Cosa manca

- Schermata **Comunicazioni** (oggi gli avvisi della palestra si
  scrivono solo in SQL).
- **Personal training**: i pacchetti ci sono, le sessioni no.
- **Chiusure** per ferie e festivi.
- **Palinsesto** modificabile dall'app (oggi solo SQL).
- **Obblighi ASD**: libro soci, tesseramento all'ente, consensi privacy.
- **Testo dell'informativa privacy**: in revisione da Filippo.
- **WOD in percentuale** calcolato sui massimali del socio.
- **Benchmark**: nessuna tabella.
- **Gruppi notifiche**: allineare i nomi nella scheda socio
  (`comunicazioni`/`comunicazione` e i mancanti) prima di costruire gli
  interruttori per tipo.
- **`outline-none` senza sostituto** in `base.jsx` (Numeretto),
  `NuovaLezione.jsx`, `GestioneClasse.jsx`.
- **Audit del lato staff**: mai fatto.
- **Prove da convertire**: `analisi`, `classi`, `coda`, `economia`,
  `ingressi`, `presenze`, `prove`, `utenteprova` stampano tabelle invece
  di dire OK/NO.

## Prima dell'apertura

- **Vercel Hobby è solo per uso non commerciale**: passare a Pro
  (20 $/mese).
- **Supabase gratuito va in pausa dopo una settimana di inattività**:
  valutare Pro (25 $/mese) se serve.

---

## Registro delle decisioni

*Una riga per decisione, la più recente in alto. Si aggiorna a fine
sessione, qui o in Claude Code. Il codice dice cosa c'è; questo dice
perché.*

- **2026-10-17** — App allineata ai neri e grigi del sito: stesso
  marchio, schede più staccate dal fondo, testo secondario più
  leggibile. `spento` coincide con `dettaglio` (più scuro falliva sulle
  schede in allarme). Home senza testi sotto 10 px.
- **2026-10-17** — Font Barlow e Montserrat ospitati in `public/fonts`,
  non più da Google Fonts: il link a Google passava l'IP di chi apre
  l'app senza consenso (GDPR, sentenza di Monaco 2022). Il sito era già
  a posto.
- **2026-10-17** — Creato questo file: le decisioni stanno nel repo,
  così le leggono sia la chat del Progetto sia Claude Code.
- **2026-10-17** — Audit accessibilità lato socio: introdotti i tre
  token di testo, 0 testi sotto contrasto, bersagli ≥ 44 px, titoli
  veri, `prefers-reduced-motion`, foto caricate scorrendo.
- **2026-10-16** — Notifiche push attive (file `db/29`–`33`). Nuovo WOD
  e risultato del compagno restano fuori.
- **2026-10-14** — Gli abbonamenti omaggio si fanno con un pacchetto a
  0 €; la quota resta dovuta.
- **2026-10-13** — Criterio staff/socio: la console è segreteria e
  analisi. Lo switch Titolare/Socio toglie i poteri.
- **2026-10-12** — Presenze confermate dal coach; i no-show non costano
  ingressi; ingressi contati, non scalati; fuso orario corretto.
