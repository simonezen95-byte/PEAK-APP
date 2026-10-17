import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, Check, Search, UserPlus, X, Clock, UserRound,
} from "lucide-react";
import {
  elencoPresenze, segnaPresenze, aggiungiAllaClasse,
  aggiungiProva, togliRiga, spiega,
} from "../lib/presenze";
import { elencoSoci } from "../lib/staff";
import { FONTI } from "../lib/analisi";
import { dataEstesa, soloOra, piuMinuti, minutiAllInizio } from "../lib/date";
import { Titolo, Avviso, Vuoto } from "../ui/base";

/* La lista da spuntare a fine classe.

   Parte senza spunte: si segna chi è venuto, non si toglie chi manca.
   È il verso giusto perché il coach guarda la sala e spunta le facce
   che vede; al contrario dovrebbe ricordarsi chi non c'è.

   Chi era in lista d'attesa sta in fondo, separato: non aveva un
   posto, e se non è entrato non è un'assenza sua. Spuntarlo lo fa
   entrare.

   Una classe si può riaprire e confermare di nuovo: le correzioni
   dopo sono la norma, non l'eccezione. */

export default function Presenze({ sessione, onIndietro, onCambiato, onMessaggio }) {
  const [righe, setRighe] = useState(null);
  const [spuntati, setSpuntati] = useState(() => new Set());
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const [aggiungi, setAggiungi] = useState(false);
  const [chiedoFonte, setChiedoFonte] = useState(false);

  const carica = useCallback(async () => {
    try {
      const lista = await elencoPresenze(sessione.sessione_id);
      setRighe(lista);
      // Se la classe è già stata confermata, le spunte ripartono da
      // come l'avevano lasciata: si correggono due nomi, non si
      // rifà tutto.
      setSpuntati(
        new Set(lista.filter((r) => r.stato === "presente").map((r) => r.prenotazione_id))
      );
    } catch (e) {
      setErrore(spiega(e));
      setRighe([]);
    }
  }, [sessione.sessione_id]);

  useEffect(() => { carica(); }, [carica]);

  const prenotati = useMemo(
    () => (righe ?? []).filter((r) => r.stato !== "lista_attesa"),
    [righe]
  );
  const coda = useMemo(
    () => (righe ?? []).filter((r) => r.stato === "lista_attesa"),
    [righe]
  );

  // Gia chiusa una volta? Lo si vede dalle righe: se qualcuno risulta
  // presente o assente, le presenze sono gia passate di qui. Meglio
  // che fidarsi di un campo che chi apre la schermata potrebbe non
  // avere sottomano.
  const giaConfermata = (righe ?? []).some(
    (r) => r.stato === "presente" || r.stato === "assente"
  );

  /* Su una lezione che deve ancora cominciare questa schermata serve
     a tenere la lista — aggiungere un socio senza prenotazione, o un
     utente prova che ha detto che viene — non a dire chi c'era. Il
     bottone di conferma compare quando la lezione è cominciata. */
  const cominciata = minutiAllInizio(sessione.data, sessione.ora) <= 0;

  function spunta(id) {
    setSpuntati((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function tutti() {
    setSpuntati(new Set(prenotati.map((r) => r.prenotazione_id)));
  }

  function nessuno() {
    setSpuntati(new Set());
  }

  async function conferma() {
    setErrore("");
    setLavoro(true);
    try {
      const quanti = await segnaPresenze(sessione.sessione_id, [...spuntati]);
      const mancati = prenotati.length - prenotati.filter((r) => spuntati.has(r.prenotazione_id)).length;
      onMessaggio(
        quanti === 0
          ? "Classe chiusa: nessun presente."
          : mancati > 0
          ? `${quanti} ${quanti === 1 ? "presente" : "presenti"}, ${mancati} ${mancati === 1 ? "assente" : "assenti"}.`
          : `${quanti} ${quanti === 1 ? "presente" : "presenti"}. C'erano tutti.`
      );
      onCambiato();
      onIndietro();
    } catch (e) {
      setErrore(spiega(e));
      setLavoro(false);
    }
  }

  async function aggiungiSocio(socio) {
    setErrore("");
    try {
      await aggiungiAllaClasse(sessione.sessione_id, socio.id);
      setAggiungi(false);
      await carica();
      onMessaggio(`${socio.nome} ${socio.cognome} aggiunto alla classe.`);
    } catch (e) {
      setErrore(spiega(e));
      setAggiungi(false);
    }
  }

  /* Prima si chiede da dove arriva.

     È l'unico momento in cui qualcuno lo sa: chi segna la prova ha la
     persona davanti. Chiesto dopo, nessuno se lo ricorda, e la
     provenienza — che è il numero per capire se la pubblicità
     funziona — resta vuota per sempre. */
  async function prova(fonte) {
    setErrore("");
    setChiedoFonte(false);
    try {
      await aggiungiProva(sessione.sessione_id, fonte);
      await carica();
      onMessaggio("Utente prova aggiunto alla classe.");
    } catch (e) {
      setErrore(spiega(e));
    }
  }

  async function togli(r) {
    setErrore("");
    try {
      await togliRiga(r.prenotazione_id);
      await carica();
      onMessaggio(
        r.prova ? "Utente prova tolto." : `${r.nome} ${r.cognome} tolto dalla classe.`
      );
    } catch (e) {
      setErrore(spiega(e));
    }
  }

  if (aggiungi) {
    return (
      <Cerca
        esclusi={new Set((righe ?? []).map((r) => r.profilo_id).filter(Boolean))}
        onScelto={aggiungiSocio}
        onIndietro={() => setAggiungi(false)}
      />
    );
  }

  const quanti = spuntati.size;

  return (
    <div className={cominciata ? "px-5 pb-56 pt-1" : "px-5 pb-28 pt-1"}>
      <button
        onClick={onIndietro}
        aria-label="Torna indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="mt-2 mb-6">
        <div className="text-[10.5px] tracking-[0.2em] text-dettaglio font-semibold">
          {giaConfermata ? "PRESENZE CONFERMATE"
           : cominciata ? "REGISTRO PRESENZE"
           : "ELENCO ISCRITTI"}
        </div>
        <div className="text-[21px] font-display font-bold text-neutral-50 leading-tight uppercase mt-1">
          {sessione.nome}
        </div>
        <div className="text-[12px] text-dettaglio first-letter:uppercase mt-0.5">
          {dataEstesa(sessione.data)}
        </div>
        <div className="text-[11.5px] text-etichetta mt-0.5">
          {/* L'ora di fine solo se la durata la conosco: arrivando
              dall'elenco delle classi da chiudere non ce l'ho, e
              inventarne una sbagliata è peggio che non scriverla. */}
          {soloOra(sessione.ora)}
          {sessione.durata_min && ` – ${piuMinuti(sessione.ora, sessione.durata_min)}`}
          {sessione.coach && <span className="text-spento"> · {sessione.coach}</span>}
        </div>
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {righe === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-scheda animate-pulse" />
          ))}
        </div>
      ) : prenotati.length === 0 && coda.length === 0 ? (
        <>
          <Vuoto>Nessuno era iscritto a questa classe.</Vuoto>
          <BottoneAggiungi
            onSocio={() => setAggiungi(true)}
            onProva={() => setChiedoFonte(true)}
          />
        </>
      ) : (
        <>
          {prenotati.length > 0 && (
            <>
              <div className="flex items-center mb-3">
                <div className="text-[11px] tracking-[0.15em] text-dettaglio font-semibold">
                  ISCRITTI ({prenotati.length})
                </div>
                <div className="flex-1" />
                <button
                  onClick={quanti === prenotati.length ? nessuno : tutti}
                  className="text-[10.5px] tracking-[0.1em] text-etichetta font-semibold"
                >
                  {quanti === prenotati.length ? "NESSUNO" : "C'ERANO TUTTI"}
                </button>
              </div>

              <div className="flex flex-col gap-2 mb-7">
                {prenotati.map((r) => (
                  <Riga
                    key={r.prenotazione_id}
                    r={r}
                    spuntato={spuntati.has(r.prenotazione_id)}
                    onSpunta={() => spunta(r.prenotazione_id)}
                    onTogli={() => togli(r)}
                  />
                ))}
              </div>
            </>
          )}

          {coda.length > 0 && (
            <>
              <Titolo>ERANO IN LISTA D'ATTESA ({coda.length})</Titolo>
              <div className="text-[11px] text-spento leading-relaxed mb-3 -mt-1">
                Non avevano un posto. Spunta solo chi è entrato davvero.
              </div>
              <div className="flex flex-col gap-2 mb-7">
                {coda.map((r) => (
                  <Riga
                    key={r.prenotazione_id}
                    r={r}
                    inCoda
                    spuntato={spuntati.has(r.prenotazione_id)}
                    onSpunta={() => spunta(r.prenotazione_id)}
                  />
                ))}
              </div>
            </>
          )}

          <BottoneAggiungi
            onSocio={() => setAggiungi(true)}
            onProva={() => setChiedoFonte(true)}
          />
        </>
      )}

      {chiedoFonte && (
        <ScegliFonte onScelto={prova} onAnnulla={() => setChiedoFonte(false)} />
      )}

      {/* Il bottone, appoggiato sopra la barra in basso. Su una
          lezione non ancora cominciata non c'è: non si confermano
          presenze di gente che deve ancora arrivare. */}
      {cominciata && (
      <div
        className="fixed left-0 right-0 px-5 pb-3 pt-6 bg-gradient-to-t from-[#050507] via-[#050507] to-transparent"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto">
          {/* Finché non c'è nessuna spunta il bottone resta spento: in
              chiaro inviterebbe il tocco d'abitudine, e quel tocco
              segnerebbe assenti tutti. */}
          <button
            onClick={conferma}
            disabled={lavoro || righe === null}
            className={`w-full rounded-xl py-3.5 text-[13px] font-bold tracking-wide disabled:opacity-30 ${
              quanti > 0
                ? "bg-neutral-50 text-black"
                : "border border-neutral-700 text-neutral-200"
            }`}
          >
            {lavoro
              ? "ATTENDI…"
              : quanti === 0
              ? "CONFERMA: NESSUN PRESENTE"
              : `CONFERMA ${quanti} ${quanti === 1 ? "PRESENTE" : "PRESENTI"}`}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

function Riga({ r, spuntato, inCoda, onSpunta, onTogli }) {
  const iniziali = `${r.nome?.[0] ?? ""}${r.cognome?.[0] ?? ""}`.toUpperCase();

  return (
    <div
      className={`rounded-2xl border p-3 flex items-center gap-3 ${
        spuntato ? "border-neutral-400 bg-neutral-50/[0.07]" : "border-bordo bg-scheda"
      }`}
    >
      <button
        onClick={onSpunta}
        aria-label={spuntato ? `${r.nome} ${r.cognome}: c'era` : `${r.nome} ${r.cognome}: segna presente`}
        aria-pressed={spuntato}
        className="flex-1 flex items-center gap-3 text-left min-w-0"
      >
        <div
          className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
            spuntato ? "bg-neutral-50 border-neutral-50" : "border-neutral-600"
          }`}
        >
          {spuntato && <Check size={14} className="text-black" strokeWidth={3.5} />}
        </div>

        <div className={`w-9 h-9 rounded-full border overflow-hidden flex items-center justify-center shrink-0 ${
          r.prova ? "border-dashed border-neutral-700" : "border-neutral-700"
        }`}>
          {r.prova ? (
            <UserRound size={15} className="text-spento" strokeWidth={1.6} />
          ) : r.foto_url ? (
            <img src={r.foto_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10.5px] font-display font-bold text-etichetta">
              {iniziali}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className={`text-[13.5px] truncate ${
            r.prova ? "text-etichetta italic" : "text-neutral-100"
          }`}>
            {r.prova ? "Utente prova" : `${r.cognome} ${r.nome}`}
          </div>
          <div className="text-[10px] text-spento mt-0.5 flex items-center gap-1">
            {r.prova ? (
              "non è un socio"
            ) : inCoda ? (
              <>
                <Clock size={10} /> in coda, {r.posizione_coda}ª
              </>
            ) : r.walk_in ? (
              "senza prenotazione"
            ) : (
              "prenotato"
            )}
          </div>
        </div>
      </button>

      {onTogli && (
        <button
          onClick={onTogli}
          aria-label={`Togli ${r.nome} ${r.cognome} dalla classe`}
          className="w-8 h-8 flex items-center justify-center text-spento shrink-0"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/* Due modi di aggiungere qualcuno, e sono cose diverse.

   Un socio senza prenotazione si cerca per cognome: è uno di casa, va
   nella sua storia e gli scala l'ingresso. Un utente prova no: non
   ha un nome da cercare perché non è nessuno, tiene solo il posto. */
/* Da dove arriva.

   Compare appoggiato in basso, sopra tutto il resto: è una domanda
   sola e si risponde con un tocco, senza cambiare schermata e senza
   perdere di vista la classe.

   C'è anche "non lo so": una provenienza inventata è peggio di una
   provenienza mancante, perché la seconda si vede nei conti e la
   prima no. */
function ScegliFonte({ onScelto, onAnnulla }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-label="Da dove arriva la persona"
    >
      <button
        onClick={onAnnulla}
        aria-label="Annulla"
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative w-full max-w-md mx-auto bg-scheda border-t border-bordo rounded-t-3xl p-5 pb-8">
        <div className="text-[13px] text-neutral-100 mb-1">
          Da dove arriva?
        </div>
        <div className="text-[11px] text-dettaglio mb-4 leading-relaxed">
          Serve a capire cosa porta gente in palestra. Non si registra
          nient'altro della persona.
        </div>

        <div className="grid grid-cols-2 gap-2">
          {FONTI.map((f) => (
            <button
              key={f.chiave}
              onClick={() => onScelto(f.chiave)}
              className="rounded-xl border border-bordo bg-rilievo py-3 text-[12.5px] text-neutral-100"
            >
              {f.nome}
            </button>
          ))}
        </div>

        <button
          onClick={() => onScelto(null)}
          className="w-full mt-3 py-3 text-[12px] text-dettaglio"
        >
          Non lo so
        </button>
      </div>
    </div>
  );
}

function BottoneAggiungi({ onSocio, onProva }) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onSocio}
        className="w-full rounded-2xl border border-dashed border-bordo p-3.5 flex items-center justify-center gap-2.5 text-etichetta"
      >
        <UserPlus size={15} strokeWidth={1.8} />
        <span className="text-[12px] font-semibold">
          È arrivato un socio senza prenotazione
        </span>
      </button>
      <button
        onClick={onProva}
        className="w-full rounded-2xl border border-dashed border-bordo p-3.5 flex items-center justify-center gap-2.5 text-dettaglio"
      >
        <UserRound size={15} strokeWidth={1.8} />
        <span className="text-[12px] font-semibold">Aggiungi un utente prova</span>
      </button>
    </div>
  );
}

/* La ricerca per aggiungere qualcuno al volo. Cerca fra tutti i soci,
   non solo fra quelli in regola: chi è sulla porta ci è già entrato,
   e il posto irregolare si sistema in reception, non cancellando la
   presenza. Però lo segnala. */
function Cerca({ esclusi, onScelto, onIndietro }) {
  const [testo, setTesto] = useState("");
  const [soci, setSoci] = useState(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      elencoSoci(testo)
        .then((lista) => { if (vivo) setSoci(lista); })
        .catch(() => { if (vivo) setSoci([]); });
    }, testo ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [testo]);

  const lista = (soci ?? []).filter((s) => !esclusi.has(s.id));

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna alla lista"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="text-[19px] font-display font-bold text-neutral-50 uppercase mt-2 mb-5">
        Chi è arrivato?
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-spento" />
        <input
          autoFocus
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Cognome o nome"
          className="w-full bg-scheda border border-bordo rounded-xl pl-10 pr-3 py-3 text-[13.5px] text-neutral-100 placeholder:text-spento outline-none focus:border-neutral-600"
        />
      </div>

      {soci === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-scheda animate-pulse" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Vuoto>
          {testo ? "Nessun socio con questo nome." : "Nessun socio da aggiungere."}
        </Vuoto>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.slice(0, 30).map((s) => (
            <button
              key={s.id}
              onClick={() => onScelto(s)}
              className="rounded-2xl border border-bordo bg-scheda p-3 flex items-center gap-3 text-left"
            >
              {/* Qui le iniziali e non la foto: l'elenco dei soci non
                  la porta, e per cercare un cognome non serve. */}
              <div className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
                <span className="text-[10.5px] font-display font-bold text-etichetta">
                  {`${s.nome?.[0] ?? ""}${s.cognome?.[0] ?? ""}`.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] text-neutral-100 truncate">
                  {s.cognome} {s.nome}
                </div>
                {s.in_regola === false && (
                  <div className="text-[10px] text-dettaglio mt-0.5">
                    posizione da sistemare in reception
                  </div>
                )}
              </div>
              <UserPlus size={15} className="text-spento shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
