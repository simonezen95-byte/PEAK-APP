import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Plus, Megaphone, Trash2, Smartphone } from "lucide-react";
import { useSessione } from "../lib/sessione";
import {
  elenco, pubblica, togli, quantiAvviserei, quando,
  puoScrivere, puoAvvisare,
} from "../lib/comunicazioni";
import {
  Card, Titolo, TitoloSchermata, Avviso, Vuoto, Bottone,
  Scheletro, Interruttore,
} from "../ui/base";

/* Gli avvisi della palestra.

   Fino a oggi si scrivevano solo con un comando SQL, e non avvisavano
   nessuno.

   Due permessi, due gesti diversi: con la bacheca l'avviso resta
   dentro l'app, dove il socio lo trova quando apre; con l'altro
   squilla anche il telefono. Chi ha solo il primo vede l'interruttore
   bloccato e scritto perché, invece di un interruttore che non
   funziona e basta.

   Una comunicazione pubblicata non si corregge. Se è uscita sui
   telefoni, la frase che le persone hanno letto è quella: si toglie e
   si riscrive. */

export default function Comunicazioni({ onIndietro, onMessaggio }) {
  const { profilo } = useSessione();
  const [righe, setRighe] = useState(null);
  const [scrive, setScrive] = useState(false);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    try {
      setRighe(await elenco(30));
    } catch {
      setErrore("Non riesco a leggere le comunicazioni.");
      setRighe([]);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  async function elimina(c) {
    setErrore("");
    try {
      await togli(c.id);
      await carica();
      onMessaggio("Comunicazione tolta.");
    } catch {
      setErrore("Non sono riuscito a toglierla. Riprova.");
    }
  }

  if (scrive) {
    return (
      <Scrittura
        profilo={profilo}
        onIndietro={() => setScrive(false)}
        onFatto={async (quanti) => {
          setScrive(false);
          await carica();
          onMessaggio(
            quanti > 0
              ? `Pubblicata. Avvisati ${quanti} soci.`
              : "Pubblicata in bacheca."
          );
        }}
      />
    );
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Indietro"
        className="w-11 h-11 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <TitoloSchermata comeSta="text-[21px] font-display font-bold text-neutral-50 uppercase leading-tight mt-2 mb-5">
        Comunicazioni
      </TitoloSchermata>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {puoScrivere(profilo) && (
        <button
          onClick={() => setScrive(true)}
          className="w-full rounded-xl border border-bordo min-h-[44px] mb-7 flex items-center justify-center gap-2 text-[12px] font-bold tracking-[0.08em] text-neutral-100"
        >
          <Plus size={15} strokeWidth={2.4} />
          SCRIVI UNA COMUNICAZIONE
        </button>
      )}

      <Titolo>PUBBLICATE</Titolo>

      {righe === null ? (
        <Scheletro righe={3} />
      ) : righe.length === 0 ? (
        <Vuoto>
          Nessuna comunicazione.
          <br />
          Quelle che scrivi compaiono nella home dei soci.
        </Vuoto>
      ) : (
        <div className="flex flex-col gap-2.5">
          {righe.map((c) => (
            <Riga key={c.id} c={c} onTogli={() => elimina(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Riga({ c, onTogli }) {
  const [conferma, setConferma] = useState(false);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-neutral-50 uppercase tracking-[0.04em]">
            {c.titolo}
          </div>
          <div className="text-[10.5px] text-dettaglio mt-0.5">
            {quando(c.pubblicata_il)} · {c.autore}
            {c.avvisati > 0 && ` · ${c.avvisati} avvisati`}
          </div>
          <div className="text-[11.5px] text-etichetta leading-relaxed mt-1.5">
            {c.testo}
          </div>
        </div>
        <button
          onClick={() => setConferma(true)}
          aria-label="Togli questa comunicazione"
          className="w-11 h-11 -m-2 flex items-center justify-center text-spento shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {conferma && (
        <div className="mt-3 pt-3 border-t border-filo">
          <div className="text-[11.5px] text-etichetta leading-relaxed mb-2.5">
            {c.avvisati > 0
              ? `È già arrivata sul telefono di ${c.avvisati} soci: togliendola sparisce dalla bacheca, non da dove l'hanno letta.`
              : "Sparisce dalla home dei soci."}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onTogli}
              className="flex-1 rounded-xl bg-neutral-100 text-black min-h-[44px] text-[11.5px] font-bold tracking-wider"
            >
              TOGLI
            </button>
            <button
              onClick={() => setConferma(false)}
              className="flex-1 rounded-xl border border-bordo text-etichetta min-h-[44px] text-[11.5px] font-bold tracking-wider"
            >
              ANNULLA
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------
   Scrivere
   ---------------------------------------------------------------- */

function Scrittura({ profilo, onIndietro, onFatto }) {
  const [titolo, setTitolo] = useState("");
  const [testo, setTesto] = useState("");
  const [avvisa, setAvvisa] = useState(false);
  const [quanti, setQuanti] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  const puoSquillare = puoAvvisare(profilo);

  useEffect(() => {
    if (!puoSquillare) return;
    quantiAvviserei().then(setQuanti).catch(() => setQuanti(null));
  }, [puoSquillare]);

  const pronto = titolo.trim().length > 0 && testo.trim().length > 0;

  async function manda() {
    setErrore("");
    setLavoro(true);
    try {
      await pubblica({
        titolo,
        testo,
        tipo: avvisa ? "avviso" : "comunicazione",
        avvisa,
      });
      onFatto(avvisa ? (quanti?.raggiungibili ?? 0) : 0);
    } catch (e) {
      const m = String(e?.message || "");
      setErrore(
        m.includes("bacheca ma non")
          ? "Puoi scrivere in bacheca ma non mandare avvisi sul telefono."
          : m.includes("Non puoi pubblicare")
          ? "Non hai il permesso di pubblicare comunicazioni."
          : "Non sono riuscito a pubblicare. Riprova."
      );
      setLavoro(false);
    }
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Indietro"
        className="w-11 h-11 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <TitoloSchermata comeSta="text-[20px] font-display font-bold text-neutral-50 mt-2 mb-5">
        Nuova comunicazione
      </TitoloSchermata>

      <div className="text-[11px] text-etichetta font-semibold mb-2">Titolo</div>
      <input
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        aria-label="Titolo della comunicazione"
        maxLength={60}
        autoComplete="off"
        className="w-full bg-scheda border border-bordo rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 outline-none focus:border-neutral-600 mb-1"
      />
      <div className="text-[10px] text-spento mb-5">
        {titolo.length}/60 — compare anche sullo schermo bloccato
      </div>

      <div className="text-[11px] text-etichetta font-semibold mb-2">Testo</div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        aria-label="Testo della comunicazione"
        rows={5}
        maxLength={400}
        className="w-full bg-scheda border border-bordo rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 leading-relaxed outline-none focus:border-neutral-600 mb-1 resize-none"
      />
      <div className="text-[10px] text-spento mb-6">{testo.length}/400</div>

      <Titolo>COME ESCE</Titolo>
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-neutral-200">
              Avvisa anche sul telefono
            </div>
            <p className="text-[11px] text-dettaglio mt-1 leading-relaxed pr-10">
              {!puoSquillare
                ? "Non hai questo permesso: la comunicazione resta nella home dei soci."
                : quanti === null
                ? "Senza, resta nella home dei soci."
                : quanti.raggiungibili === 0
                ? `Nessuno dei ${quanti.soci} soci ha acceso gli avvisi: resterebbe comunque solo nella home.`
                : `Arriva sul telefono di ${quanti.raggiungibili} soci su ${quanti.soci}. Gli altri la trovano nella home.`}
            </p>
          </div>
          <Interruttore
            acceso={avvisa}
            onCambia={() => setAvvisa((v) => !v)}
            bloccato={!puoSquillare || quanti?.raggiungibili === 0}
            etichetta="Avvisa anche sul telefono"
          />
        </div>
      </Card>

      {avvisa && (
        <div className="mb-5">
          <Avviso tono="nota">
            <div className="flex gap-2.5">
              <Smartphone size={15} className="text-etichetta shrink-0 mt-0.5" />
              <span>
                Una comunicazione pubblicata non si corregge: se è uscita sui
                telefoni, si toglie e si riscrive. Rileggi prima di mandarla.
              </span>
            </div>
          </Avviso>
        </div>
      )}

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <Bottone onClick={manda} disabled={!pronto} carica={lavoro}>
        {avvisa ? "PUBBLICA E AVVISA" : "PUBBLICA IN BACHECA"}
      </Bottone>

      <div className="flex items-center gap-2 justify-center mt-5 text-[11px] text-spento">
        <Megaphone size={13} />
        Compare nella home dei soci, sotto &ldquo;Dal box&rdquo;.
      </div>
    </div>
  );
}
