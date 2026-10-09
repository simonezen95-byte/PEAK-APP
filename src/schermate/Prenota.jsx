import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, DoorOpen, Check, Clock } from "lucide-react";
import { useSessione } from "../lib/sessione";
import {
  settimana as leggiSettimana,
  mioAccesso,
  ostacoli,
  soloOpenBox,
} from "../lib/prenotazioni";
import {
  lunedi, piuGiorni, oggiIso, giornoCorto, numeroGiorno,
  meseEAnno, dataEstesa, soloOra, piuMinuti, minutiAllInizio, eOggi,
} from "../lib/date";
import { Card, Scheletro, Vuoto, Avviso } from "../ui/base";

/* Il calendario del socio: una settimana per volta, un giorno alla
   volta. Le classi in alto, le fasce di Open Box sotto. */

export default function Prenota({ onApri, ricarica }) {
  const { profilo } = useSessione();
  const [settimanaDal, setSettimanaDal] = useState(() => lunedi(oggiIso()));
  const [giorno, setGiorno] = useState(() => oggiIso());
  const [righe, setRighe] = useState(null);
  const [accesso, setAccesso] = useState(null);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    setErrore("");
    try {
      const [s, a] = await Promise.all([leggiSettimana(settimanaDal), mioAccesso()]);
      setRighe(s);
      setAccesso(a);
    } catch {
      setRighe([]);
      setErrore("Non riesco a leggere il calendario. Riprova fra poco.");
    }
  }, [settimanaDal]);

  useEffect(() => { carica(); }, [carica, ricarica]);

  // Cambiando settimana il giorno scelto deve restarci dentro.
  function spostaSettimana(passo) {
    const nuova = piuGiorni(settimanaDal, passo * 7);
    setSettimanaDal(nuova);
    setRighe(null);
    setGiorno(
      passo > 0 ? nuova
        : nuova === lunedi(oggiIso()) ? oggiIso() : piuGiorni(nuova, 6)
    );
  }

  const giorni = Array.from({ length: 7 }, (_, i) => piuGiorni(settimanaDal, i));
  const delGiorno = (righe ?? []).filter((r) => r.data === giorno);
  const classi = delGiorno.filter((r) => r.tipo === "classe");
  const openbox = delGiorno.filter((r) => r.tipo === "openbox");

  const blocchi = ostacoli(accesso, giorno);
  const senzaClassi = soloOpenBox(accesso);

  return (
    <div className="px-5 pb-28 pt-2">
      {/* Settimana */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => spostaSettimana(-1)}
          disabled={settimanaDal <= lunedi(oggiIso())}
          aria-label="Settimana precedente"
          className="w-9 h-9 flex items-center justify-center text-neutral-400 disabled:opacity-20"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-[13px] text-neutral-300 font-semibold capitalize">
          {meseEAnno(settimanaDal)}
        </div>
        <button
          onClick={() => spostaSettimana(1)}
          aria-label="Settimana successiva"
          className="w-9 h-9 flex items-center justify-center text-neutral-400"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Giorni */}
      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {giorni.map((g) => {
          const scelto = g === giorno;
          const passato = g < oggiIso();
          return (
            <button
              key={g}
              onClick={() => setGiorno(g)}
              className={`rounded-xl py-2.5 flex flex-col items-center gap-0.5 border transition-colors ${
                scelto
                  ? "bg-neutral-50 border-neutral-50 text-black"
                  : passato
                  ? "border-neutral-900 text-neutral-700"
                  : "border-neutral-800 text-neutral-300"
              }`}
            >
              <span className="text-[9.5px] uppercase tracking-wider opacity-70">
                {giornoCorto(g)}
              </span>
              <span className="text-[15px] font-display font-bold leading-none">
                {numeroGiorno(g)}
              </span>
              {eOggi(g) && (
                <span className={`w-1 h-1 rounded-full ${scelto ? "bg-black" : "bg-neutral-400"}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[12px] text-neutral-500 mb-5 capitalize">
        {dataEstesa(giorno)}
      </div>

      {errore && <div className="mb-5"><Avviso>{errore}</Avviso></div>}

      {blocchi.length > 0 && (
        <div className="mb-5 flex flex-col gap-2.5">
          {blocchi.map((b) => (
            <Card key={b.titolo} className="border-amber-900/50 bg-amber-950/20">
              <div className="text-[13px] font-semibold text-amber-200 mb-1">{b.titolo}</div>
              <div className="text-[11.5px] text-amber-200/60 leading-relaxed">{b.testo}</div>
            </Card>
          ))}
        </div>
      )}

      {righe === null ? (
        <Scheletro righe={4} />
      ) : delGiorno.length === 0 ? (
        <Vuoto>Nessuna attività in programma.</Vuoto>
      ) : (
        <>
          {classi.length > 0 && (
            <section className="mb-8">
              <Intestazione icona={Dumbbell} testo="CLASSI" />
              {senzaClassi && (
                <div className="text-[11.5px] text-neutral-500 leading-relaxed mb-3">
                  Il tuo pacchetto è Open Box: per le classi passa in reception.
                </div>
              )}
              <div className="flex flex-col gap-2.5">
                {classi.map((c) => (
                  <Riga key={c.sessione_id} r={c} onApri={() => onApri(c)} />
                ))}
              </div>
            </section>
          )}

          {openbox.length > 0 && (
            <section>
              <Intestazione icona={DoorOpen} testo="OPEN BOX" />
              <div className="flex flex-col gap-2.5">
                {openbox.map((c) => (
                  <Riga key={c.sessione_id} r={c} onApri={() => onApri(c)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Intestazione({ icona: Icona, testo }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icona size={13} className="text-neutral-500" />
      <span className="text-[11px] tracking-[0.15em] text-neutral-500 font-semibold">
        {testo}
      </span>
    </div>
  );
}

function Riga({ r, onApri }) {
  const liberi = Math.max(0, r.capienza - r.iscritti);
  const pieno = liberi === 0;
  const minuti = minutiAllInizio(r.data, r.ora);
  const passata = minuti < 0;
  const dentro = r.mio_stato === "prenotato" || r.mio_stato === "presente";
  const inCoda = r.mio_stato === "lista_attesa";

  return (
    <button
      onClick={onApri}
      className={`w-full rounded-2xl border p-3.5 flex items-center gap-3.5 text-left transition-colors ${
        dentro
          ? "border-neutral-400 bg-neutral-50/[0.07]"
          : inCoda
          ? "border-neutral-700 bg-neutral-900/70"
          : passata || r.annullata
          ? "border-neutral-900 bg-neutral-950 opacity-50"
          : "border-neutral-800 bg-neutral-900/70"
      }`}
    >
      <div className="shrink-0">
        <div className="text-[16px] font-display font-bold text-neutral-50 leading-none">
          {soloOra(r.ora)}
        </div>
        <div className="text-[10px] text-neutral-600 mt-1">
          {piuMinuti(r.ora, r.durata_min)}
        </div>
      </div>

      <div className="w-px self-stretch bg-neutral-800" />

      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-neutral-100 font-semibold truncate">
          {r.annullata ? "Annullata" : r.nome}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
          {r.annullata
            ? r.motivo_annullo || "La lezione non si tiene"
            : r.coach
            ? r.coach
            : `${r.durata_min} min`}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {dentro ? (
          <Etichetta chiara icona={Check}>PRENOTATO</Etichetta>
        ) : inCoda ? (
          <Etichetta icona={Clock}>IN CODA {r.mia_posizione}</Etichetta>
        ) : (
          <>
            <div className={`text-[13px] font-semibold ${pieno ? "text-neutral-500" : "text-neutral-100"}`}>
              {r.iscritti}<span className="text-neutral-600">/{r.capienza}</span>
            </div>
            <div className="text-[10px] text-neutral-600 mt-0.5">
              {pieno ? "pieno" : r.in_coda > 0 ? `${r.in_coda} in coda` : "posti"}
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function Etichetta({ chiara, icona: Icona, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-bold tracking-wider ${
        chiara ? "bg-neutral-50 text-black" : "border border-neutral-600 text-neutral-300"
      }`}
    >
      <Icona size={10} strokeWidth={3} />
      {children}
    </span>
  );
}
