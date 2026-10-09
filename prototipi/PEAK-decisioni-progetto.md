# PEAK Functional Fitness — App

*Ultimo aggiornamento: 7 settembre 2026*

Documento di riferimento con tutte le decisioni prese durante la progettazione.
Da usare insieme ai file `peak-app-prototype.jsx` (lato socio) e `peak-admin-dashboard.jsx` (lato admin).

---

## 1. Obiettivo e strategia

- App per la gestione della palestra PEAK Functional Fitness (Maser, TV).
- **Distribuzione come PWA**, non tramite App Store / Google Play: i clienti ricevono un link e installano l'app sulla schermata home del telefono.
- **Sviluppo interno** con Claude Code, non tramite agenzia. Budget target: costo dell'abbonamento mensile + hosting e database gratuiti (Vercel / Firebase o Supabase), dominio opzionale (~10-15 €/anno).
- Il prototipo React è la specifica visiva e funzionale da cui partire.

---

## 2. Brand

- **Font**: Barlow Extra Bold per titoli e numeri, Montserrat per il testo.
- **Colori**: `#F5F5F5` (bianco), `#A7A7A7` (grigio chiaro), `#333333` (grigio scuro), `#0D0D0D` (nero).
- **Stile**: scuro, minimale, ad alto contrasto. Nessun colore acceso, tranne il verde usato per gli stati "Attivo".
- **Logo**: PEAK con la A a forma di montagna, sottotitolo FUNCTIONAL FITNESS.
- **Slogan**: "Find your peak. Become your peak."

---

## 3. Palinsesto e capienze

| Giorno | Classi (Functional, 60 min) | Open Box |
|---|---|---|
| Lunedì / Mercoledì / Venerdì | 06:30 · 12:45 · 17:30 · 18:30 · 19:30 | 08:00–14:00 e 17:00–21:00 |
| Martedì / Giovedì | 12:45 · 17:30 · 18:30 · 19:30 | 08:00–14:00 e 17:00–21:00 |
| Sabato | 10:30 · 11:30 | 10:00–13:00 |
| Domenica | chiuso | chiuso |

- **Chiusura mattina feriale alle 14:00**: la classe delle 12:45 finisce alle 13:45, quindi il box resta aperto fino alle 14. Il sabato chiude alle 13:00 perché l'ultima classe finisce alle 12:30.
- **Orari di segreteria** = orari dell'Open Box. Telefono PEAK (tenuto in segreteria): +39 393 765 2236.
- **Capienza classi**: 15 posti.
- **Capienza Open Box**: 10 persone per fascia oraria da 60 minuti.
- L'Open Box si prenota per singole fasce da un'ora; si possono selezionare **più fasce anche non consecutive**.
- Nessun limite giornaliero di fasce Open Box (il limite dipenderà dal tipo di abbonamento).
- Il calendario mostra **7 giorni** generati dinamicamente a partire da oggi.
- **Tutto il palinsesto sarà modificabile dalla sezione Admin.**

---

## 4. Prenotazioni

- **Disdetta**: consentita fino a **15 minuti** prima dell'inizio. Dopo, il pulsante si disattiva e il socio deve avvisare lo staff.
- **Promemoria**: notifica **1 ora prima** dell'inizio della classe o della fascia Open Box.
- **Lista d'attesa**: se la classe è piena il socio entra in coda; se qualcuno disdice viene **promosso automaticamente** e riceve una notifica.
- La notifica della lista d'attesa **non è disattivabile** (rischio di perdere il posto).
- La lista degli iscritti a una classe è **sempre visibile a tutti**: non esiste opzione per nascondersi.
- Nella Home è presente la sezione **"Le mie prenotazioni"** con classi e Open Box futuri, ordinati per data.

---

## 5. Presenze e statistiche

- Le presenze sono **confermate dallo staff** al termine di ogni classe, non auto-dichiarate.
- Sessioni, ore di allenamento, tasso di presenza e streak si calcolano **solo sulle presenze confermate**.
- **Streak**: settimane consecutive con **almeno 1 presenza confermata**. Se si salta una settimana, riparte da zero.

---

## 6. WOD

- L'admin pubblica il WOD del giorno. Nei giorni di chiusura non esiste WOD.
- **Tre versioni** dello stesso WOD, con movimenti e carichi diversi:
  - **RX** (es. Muscle Up)
  - **SCALED** (es. Chest to Bar)
  - **OPEN** (es. Pull Up assistiti)
- Il socio sceglie la versione; la scelta determina anche la categoria con cui salva lo score e i filtri della classifica.
- **Tipo di score** deciso dall'admin, con inserimento guidato e validato:
  - **Tempo** → formato `mm:ss`, i due punti si inseriscono da soli, classifica dal più veloce.
  - **Ripetizioni** → solo numeri interi, classifica dal più alto.
  - **Carico (kg)** → numeri con un decimale, classifica dal più pesante.
- **Carichi personali da percentuale**: se l'admin scrive il WOD in percentuale (es. Back Squat 5x5 @ 75%), l'app calcola il carico del singolo socio dal suo PR e lo mostra in una sezione **"I tuoi carichi", visibile solo a lui**. La prescrizione del WOD resta identica per tutti.
  - Se il socio ha solo un massimale a più ripetizioni (3RM, 5RM), l'1RM viene **stimato con la formula di Epley** e la stima viene dichiarata.
  - Il carico è mostrato **esatto, senza arrotondamenti**.
  - Se il PR ha **più di 6 mesi** compare un avviso di verificare il carico con il coach.
  - Se manca il PR, compare l'invito ad aggiungerlo con scorciatoia diretta.
- Se il WOD è scritto in chili, la sezione "I tuoi carichi" non compare.
- **Pubblicazione immediata**: appena lo staff salva, il WOD è visibile ai soci, anche se riguarda i giorni successivi. Niente bozze né programmazione.
- **RX obbligatoria, Scaled e Open facoltative.** "Aggiungi Scaled" parte da una copia di RX, "Aggiungi Open" da una copia di Scaled (o di RX se Scaled non c'è).
- **Movimenti a righe di testo libere**, una per riga. Le righe tutte in maiuscolo (es. "5 ROUNDS") diventano intestazioni.
- Le righe con percentuale (`Back Squat 5x5 @ 75%` o `Back Squat @ 75%`) vengono riconosciute come carichi personali. Se il nome non coincide con la libreria esercizi, l'editor avvisa che i soci non vedranno il carico calcolato.
- **Gestione lato admin**: striscia di 3 settimane (una indietro, due avanti), copia di un WOD su un altro giorno (gli score non si copiano), "parti da un WOD già fatto" per compilarne uno nuovo, eliminazione con conferma (elimina anche gli score).
- **Vincoli per non rompere le classifiche**: con score già salvati non si può cambiare il tipo di score né rimuovere una versione che ha score.
- **Warm up**: campo facoltativo del WOD, una riga per movimento. Si vede **solo sullo schermo TV e nel gestionale**, mai nell'app dei soci.
- **Schermo TV**: pagina `/tv/<codice>` senza login, aperta da una chiavetta HDMI in modalità kiosk. Mostra data, orologio, prossima classe, warm up a sinistra e WOD a destra con le versioni affiancate, time cap e tipo di score. La dimensione del testo si adatta da sola alla quantità di righe. Domenica mostra "Box chiuso", un giorno senza WOD "WOD in arrivo". Il warm up non ha versioni. Nel gestionale c'è l'anteprima dal pulsante "Schermo TV".
- **Score dei soci**: lo staff vede anche quelli privati (con lucchetto, fuori classifica), può correggerli o eliminarli. La correzione resta attribuita a chi l'ha fatta.

---

## 7. Progress

Tre schede:

- **Panoramica** — streak, sessioni totali, media settimanale, variazione sul mese, grafico presenze, statistiche generali, ultime attività.
- **WOD** — trend RX (con selettore periodo), ripartizione RX/Scaled, ultimi score, benchmark.
- **PR** — ultimi 5 personal record aggiornati, con "Vedi tutti" per la lista completa. Grafico andamento, storico con modifica/eliminazione.

Inserimento autonomo da parte del socio, con librerie ricercabili:

- **Esercizi**: ~50 movimenti divisi per categoria (olimpico, squat, tirate, spinte, ginnastica, accessori), con tipo di massimale **1RM / 2RM / 3RM / 5RM / 10RM**.
- **Benchmark**: The Girls, Hero WOD, classici. Selezionandone uno la descrizione si compila da sola.
- Se un esercizio o un benchmark non è in lista, il socio **può crearlo**.

---

## 8. Privacy

- Score dei WOD e PR sono **sempre salvati** e visibili al socio nei suoi progressi.
- La **condivisione è una scelta separata**, su due livelli:
  - preferenza generale nel Profilo (mostra score in classifica / mostra PR);
  - scelta caso per caso al momento del salvataggio.
- Gli score privati non compaiono in classifica; il socio vede un riquadro con il proprio risultato e un lucchetto.

---

## 9. Registrazione e accesso

- Login con email e password, con recupero password via link email.
- Registrazione: foto profilo (facoltativa), nome, cognome, email, password + conferma, accettazione privacy policy obbligatoria.
- **Ogni nuovo iscritto resta in attesa di approvazione manuale da parte dell'admin.** Solo dopo l'approvazione può accedere.
- La foto profilo è caricabile dal dispositivo e compare ovunque (profilo, lista iscritti alle classi).
- La registrazione chiede **nome, cognome, email, telefono, data di nascita e password**. Telefono e data sono obbligatori: il primo per contattare chi salta una classe o ha il certificato scaduto, la seconda per il tesseramento.
- La **data di nascita** si inserisce con tre tendine (giorno, mese, anno), identiche in registrazione e in console admin. Niente campo libero: un formato unico serve per ordinare, calcolare l'età ed esportare i tesseramenti.
- **Nessuna creazione manuale di soci dalla console admin.** Ci si registra solo dall'app; l'admin approva. Stessa logica già adottata per lo staff.

**Consensi e informativa privacy**

- La spunta in registrazione apre l'**informativa privacy** completa, consultabile anche dopo dal profilo.
- **Due consensi distinti**: l'informativa è obbligatoria; il consenso alla pubblicazione di **foto e video** è facoltativo, non blocca l'iscrizione ed è revocabile in ogni momento da *Privacy e visibilità*. Accorparli renderebbe il secondo non valido.
- La **data di scadenza del certificato medico è un dato sanitario** (categoria particolare GDPR): va dichiarata esplicitamente nell'informativa. Il documento cartaceo resta in reception e non viene caricato nell'app.
- Il testo dell'informativa è **da redigere**: se ne occupa il socio commercialista. Nel prototipo c'è una struttura segnaposto con i campi da compilare fra parentesi quadre e un numero di versione.
- **Da costruire col database**: registrare data, ora e versione dell'informativa accettata da ogni socio. È un obbligo di legge, serve a dimostrare il consenso.

**Chi può modificare i dati del socio**

Un socio potrebbe passare il proprio account a un'altra persona, cambiare i dati e rivenderle l'abbonamento. Per questo l'anagrafica si congela dopo l'approvazione, quando l'admin ha visto un documento alla consegna del certificato cartaceo.

| Campo | Chi lo modifica |
|---|---|
| Nome, cognome, data di nascita | Solo admin |
| Email | Socio, ma l'admin riceve una notifica e la vede nelle *Ultime attività* |
| Telefono, password, foto profilo | Socio |

- La segnalazione di cambio email resta sulla scheda del socio finché l'admin non la marca come verificata.

---

## 10. Notifiche

- Elenco diviso in **Da leggere** e **Già lette**; contatore sulla campanella.
- Ogni notifica è navigabile e porta al punto corrispondente (classe, WOD, profilo, comunicazione).
- Preferenze per gruppo: prenotazioni, lista d'attesa, abbonamento e tessera, comunicazioni.
- **Non disattivabili**:
  - avvisi importanti del box (chiusure, variazioni orari);
  - aggiornamenti della lista d'attesa.
- Disattivabili: eventi, novità e comunicazioni promozionali.

---

## 11. Abbonamento e certificato medico

- Card nel Profilo con tipo, stato, scadenza e ingressi rimanenti.
- **Banner di avviso in cima alla Home** negli ultimi **7 giorni** prima della scadenza dell'abbonamento. Finestra corta di proposito: su un mensile da 30 giorni una finestra da 14 terrebbe il socio "in scadenza" per metà del periodo, e un avviso sempre acceso smette di essere letto. Rinnovare in reception richiede un minuto.
- Rinnovi e modifiche si gestiscono in reception (non in app).
- Tessera PEAK con numero e validità, consultabile a schermo intero.

**Certificato medico**

- In app si registra **solo la data di scadenza**, inserita dall'admin quando il socio consegna la copia cartacea in reception. Nessun documento viene caricato o archiviato nell'app.
- Card dedicata nel Profilo con stato Valido / In scadenza / Scaduto.
- Banner di avviso in Home negli ultimi **30 giorni**. Preavviso lungo perché per rinnovare serve prenotare una visita medica, e fra appuntamento e referto passano settimane.
- Il promemoria di scadenza certificato **non è disattivabile**.

**Blocco delle prenotazioni**

- Il controllo è fatto **sulla data della classe, non sulla data odierna**: se abbonamento o certificato scadono tra 2 giorni, il socio può prenotare fino a quel giorno ma non oltre.
- Con **abbonamento scaduto** o **certificato scaduto** il socio non può prenotare classi né Open Box.
- Il blocco è visibile con un avviso in cima alla schermata Classi, nel dettaglio classe e nella schermata Open Box; i pulsanti di prenotazione si disattivano.
- Le prenotazioni già effettuate restano valide e disdicibili.
- **Scaduto non significa escluso**: il socio accede all'app e vede tutto il proprio profilo — home, WOD, progressi, PR, comunicazioni, prenotazioni. Perde solo la possibilità di prenotarne di nuove. Gli unici che non entrano sono chi non è ancora stato approvato e chi è stato sospeso dallo staff.
- Lato admin serve una dashboard con le allerte su abbonamenti e certificati in scadenza o scaduti.

---

## 12. Struttura schermate

**Lato socio — completato nel prototipo**

1. Login / Crea account / Profilo in attesa di approvazione / Recupero password
2. Home (banner scadenza, le mie prenotazioni, prossima classe, WOD del giorno, progressi, comunicazioni)
3. Classi (calendario 7 giorni, Open Box, lista classi con prenotazione diretta)
4. Dettaglio classe (iscritti, lista d'attesa, prenota/disdici)
5. Open Box (selezione fasce orarie)
6. WOD (tre versioni, carichi personali, score, classifica)
7. Progress (Panoramica / WOD / PR + schermate di dettaglio)
8. Profilo (abbonamento, tessera, dati personali, notifiche, privacy, password, installa app, assistenza, logout)
9. Notifiche

**Lato admin — da costruire**

1. Dashboard
2. Utenti (lista, profilo, cronologia abbonamenti, statistiche, non rinnovati)
3. Classi e gestione presenze
4. Open Box
5. Comunicazioni
6. Abbonamenti (tipologie)
7. Staff e permessi
8. Impostazioni box
9. Notifiche automatiche
10. Account admin

---

## 13. Idee per il futuro — sezione Community

Sesta voce nel menu in basso, accanto a Home / Classi / WOD / Progress / Profilo.
Bacheca in stile Strava, ma orientata alla **costanza e non alla competizione**.

**Principio guida**

- L'obiettivo è dare voglia di tornare ad allenarsi, non alimentare il confronto tra soci.
- I badge premiano ciò che dipende dalla volontà (costanza, presenze, WOD completati, settimane di fila), non il talento o i carichi più alti.

**Contenuti dei post**

- Classe completata con score (es. "Marco P. ha completato la classe del 07/09/2026 — 12:25 RX").
- Traguardi automatici: cifre tonde di lezioni frequentate, settimane consecutive di streak, PR battuti.
- Possibilità di allegare al post una **foto o un selfie** (es. foto di gruppo a fine classe).

**Interazione**

- Gli altri soci possono assegnare un **PEAK** (equivalente del "mi piace") a un traguardo o a uno score.

**Privacy — punto centrale**

- Il socio ha un **profilo pubblico che gestisce lui**, decidendo cosa mostrare dei propri risultati.
- Nessuna pubblicazione automatica non voluta: si integra con le impostazioni privacy già presenti (score e PR privati non generano post).
- Interruttori separati per score e per traguardi: si può voler nascondere i tempi ma condividere volentieri i traguardi di costanza.

**Note tecniche**

- Serve una moderazione minima (poter nascondere o rimuovere un post, soprattutto con le foto).
- Le foto richiedono uno storage (Firebase / Supabase Storage) e attenzione al consenso di chi compare nelle foto di gruppo.
- Una bacheca legge molti più dati di una schermata personale: da tenere d'occhio nei piani gratuiti, comunque ampiamente sufficienti per una palestra.

---

## 14. Lato admin — accesso, ruoli e permessi

**Accesso**

- Login unico e identico per tutti: non esiste una schermata di accesso separata per l'admin.
- Il ruolo è un campo sul profilo utente. Se il profilo ha un ruolo di staff, compare il selettore **Admin / Socio** nel menu dell'avatar.
- Chi ha un ruolo di staff **resta socio a tutti gli effetti**: prenota, compare nelle liste iscritti, ha i propri progressi.
- Al login l'app riapre **l'ultima vista usata** (preferenza salvata sul dispositivo, quindi per dispositivo e non per account).
- **Nessun indicatore** di attività admin in sospeso quando si è in vista socio: le notifiche push restano il canale per iscrizioni in attesa e certificati scaduti.

**Ruoli**

| Ruolo | Ambito |
|---|---|
| **Owner** | Una sola email, non eliminabile né declassabile. Unico a vedere Staff e permessi e Impostazioni box. Definito in fase di setup. |
| **Admin** | Gestione operativa: soci, approvazioni, certificati, abbonamenti, classi, WOD, comunicazioni. Non tocca ruoli e configurazione del box. |
| **Coach** | Console ridotta: dashboard, classi con conferma presenze, WOD e Open Box in lettura. |
| **Socio** | Nessuna console. |

- Si diventa staff **solo se già soci registrati e approvati**, tramite promozione dalla propria scheda. Nessun invito a indirizzi email esterni.
- **Solo l'owner assegna i ruoli.**

**Permessi**

- Il ruolo applica un **preset di caselle**; l'owner può spuntarne altre sul singolo profilo (es. dare i WOD a un coach specifico).
- Aree e caselle:
  - *Soci* — vedere anagrafica · approvare iscrizioni · modificare schede e certificati
  - *Abbonamenti* — vedere · registrare rinnovi e pagamenti
  - *Classi* — vedere palinsesto · modificare palinsesto · confermare presenze · iscrivere o rimuovere soci
  - *Open Box* — gestire slot e prenotazioni
  - *WOD* — scrivere e pubblicare · modificare i punteggi altrui
  - *Comunicazioni* — inviare a tutti · pubblicare avvisi in bacheca
- **Preset coach**: vedere palinsesto, confermare presenze, vedere anagrafica.
- **Preset admin**: tutta la gestione operativa.
- **Fuori dalla lista, riservate all'owner**: staff e permessi, impostazioni box, eliminazione di un account. Non sono concedibili per errore.
- Niente permessi granulari sparsi oltre queste caselle: se serve un'eccezione ricorrente, meglio aggiungere un ruolo.

**Conseguenza sul palinsesto**

- Un coach conferma le presenze **solo delle classi che tiene**: ogni sessione del palinsesto deve avere un **coach assegnato** (campo nuovo, da aggiungere in Classi).
- Se una classe non ha coach assegnato, la conferma presenze spetta all'admin.

**Schermata Staff**

- Visibile **solo all'owner**. Per gli altri admin la voce non esiste nel menu.
- **Nessun pulsante "Aggiungi staff"**: non si creano account da qui. Si promuove un socio già registrato e approvato, cercandolo per nome.
- **Nessun badge owner in interfaccia**: nella lista l'owner appare come admin al pari degli altri. La differenza si vede solo entrando nella schermata che gli altri non hanno.
- Il profilo dell'owner ha ruolo e permessi bloccati nella propria scheda, per non potersi escludere dalla gestione.
- **Niente casella "accesso area admin"**: chi è nello staff ha l'accesso per definizione.
- I passaggi di ruolo (coach ↔ admin, e la promozione diretta ad admin) richiedono una **conferma esplicita** che elenca cosa viene concesso o tolto. Le modifiche ai soli permessi sono immediate perché reversibili.
- "Rimuovi dallo staff" richiede conferma e chiarisce che la persona **torna socio** mantenendo account, prenotazioni e progressi.
- Ogni deroga al preset è contata nella scheda ("n eccezioni al preset") per individuare a colpo d'occhio chi ha permessi fuori standard.

**Dispositivi condivisi**

- Anche sul tablet della reception **ognuno entra con il proprio profilo**. Nessun account generico di postazione.
- Serve quindi un **logout rapido** nel menu dell'avatar, accanto allo switch di ruolo.
- La sessione non resta aperta all'infinito su un dispositivo condiviso: scadenza per inattività, oppure marcatura del dispositivo come condiviso.
- Non serve richiedere la password per confermare un cambio di ruolo: il login personale è già la garanzia.

**Tracciabilità e statistiche**

- Ogni azione operativa resta attribuita a chi l'ha compiuta: conferme presenze, approvazioni iscrizioni, pubblicazione WOD, modifiche abbonamenti.
- Serve come storico operativo (capire chi ha registrato cosa), non come sorveglianza.
- Abilita **statistiche per coach**: classi tenute, presenze registrate, riempimento medio delle proprie fasce.
- Da leggere come **carico di lavoro, non come classifica**: il riempimento dipende molto più dall'orario che dal coach. Se mostrate in dashboard, vanno sempre affiancate all'orario della classe.

**Sicurezza**

- Nascondere l'interfaccia non basta: le regole di sicurezza su Firebase/Supabase devono replicare i permessi lato server, altrimenti un account socio può chiamare le API di scrittura admin.

---

## 15. Lato admin — interfaccia

- **Layout responsive**: bottom tab bar su telefono (Dashboard · Utenti · Classi · WOD · Altro), sidebar con tutte le sezioni su tablet e desktop. Le voci occasionali (Open Box, Comunicazioni, Abbonamenti, Staff, Impostazioni) stanno in "Altro": la barra in basso va a ciò che si usa ogni giorno.
- **Dashboard**: saluto e data, quattro riquadri KPI (utenti attivi, classi oggi, prenotazioni Open Box, nuove richieste), *Prossime attività* con le card Classi e Open Box (prossimo slot e barra di riempimento), *Ultime attività*, *Il box in numeri* con grafico presenze settimanali.
- **Schermata giornata**: selettore Classi / Open Box, righe con orario, occupazione e pallino di stato — verde disponibile, ambra quasi pieno, rosso completo.
- Il verde resta il colore degli stati positivi come da linea brand; ambra e rosso sono ammessi **solo** come indicatori di occupazione e scadenza nella console admin.

**Sezione Utenti**

- **Lista**: ricerca per nome, email o numero tessera; filtri per stato (Tutti, Attivi, In scadenza, Scaduti, Da completare, Non rinnovati, Sospesi) con contatore. Ogni riga mostra nome, stato, tipo di abbonamento e la scadenza più urgente fra abbonamento e certificato.
- **Richieste di iscrizione**: coda di approvazione raggiungibile da un banner in cima alla lista e dalla KPI in Dashboard. Approvare o rifiutare; il rifiuto elimina l'account e la persona può registrarsi di nuovo.
- Dopo l'approvazione il socio entra nell'app ma resta **"Da completare"** finché l'admin non registra abbonamento e scadenza del certificato. Senza quei due dati non può prenotare.
- **Scheda socio** a tre schede: *Panoramica* (abbonamento, certificato, anagrafica, azioni), *Prenotazioni* (prossime prenotazioni disdicibili dall'admin, ultimi accessi con esito), *Storico* (andamento e cronologia abbonamenti). Nessuna scheda "Note".
- **Statistiche utenti**: schermata dedicata, raggiungibile dalla lista. Soci attivi, in scadenza, non rinnovati, tasso di rinnovo, certificati da sistemare, schede da completare; distribuzione degli abbonamenti e andamento dei nuovi iscritti.
- **Sospendi** blocca l'accesso conservando storico, presenze e PR ed è reversibile. **Elimina** cancella tutto e non si può annullare.

**Definizioni condivise**

- **Socio attivo** = abbonamento e certificato entrambi ancora validi. È l'unica definizione: la usano la KPI in Dashboard e le Statistiche. Uno scaduto non è attivo.
- **Stato del socio**: si calcola su abbonamento **e** certificato insieme. Con certificato scaduto lo stato è "Scaduto" anche se l'abbonamento è valido.
- **In scadenza** = **7 giorni** o meno per l'abbonamento, **30 giorni** o meno per il certificato. Stesse finestre degli avvisi lato socio: diverse perché diverso è il tempo necessario a rimediare.
- **Non rinnovato** = scaduto da oltre **30 giorni**. Sotto quella soglia c'è chi rinnova con qualche giorno di ritardo, che è la normalità.

---

## 16. Da definire

- Tipologie di abbonamento e relativi limiti di ingressi (influenzano i limiti dell'Open Box).
- Gestione dei "no-show" dopo la chiusura della disdetta.
- Immagini reali dell'app (sfondi, foto WOD): nel prototipo sono placeholder.
- Prototipi admin ancora da fare: Classi e presenze, Open Box, Comunicazioni, Impostazioni box, Notifiche automatiche, Account admin. (Dashboard, Utenti, Staff, Abbonamenti e WOD completati.)
- **Staff e soci sono ancora due elenchi separati** nel prototipo, ma le regole dicono che chi è staff resta socio a tutti gli effetti. Da unificare in un solo archivio.
- Testo definitivo dell'informativa privacy, da redigere.
- Tracciamento della versione di informativa accettata da ogni socio.
- **Logo**: nell'app è incorporato il PNG reale reso trasparente. Quando arriva il file vettoriale va sostituito (path unico nel componente `Logo`).
- Nota tecnica prototipo: gli artefatti usano un foglio Tailwind precompilato. Niente classi con unità viewport (`vh`, `dvh`, `svh`) e niente `react-dom`.
- Campo **coach assegnato** da aggiungere alle sessioni del palinsesto.
