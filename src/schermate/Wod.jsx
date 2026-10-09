import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Timer, Pencil, Lock, Flame } from "lucide-react";
import { useSessione } from "../lib/sessione";
import {
  wodDelGiorno, classifica as leggiClassifica, salvaScore, togliScore,
  puoScrivereWod, scriviScore, leggiScore, unitaScore, VARIANTI,
} from "../lib/wod";
import { dataEstesa, oggiIso, piuGiorni } from "../lib/date";
import { Card, Titolo, Avviso, Bottone, Montagna, Vuoto } from "../ui/base";
import Redazione from "./WodRedazione";

/* Il WOD del giorno: cosa si fa, con quale versione, e come è andata
   agli altri. */

export default function Wod({ giornoIniziale, onIndietro, onMessaggio }) {
  const { profilo } = useSessione();
  const [giorno, setGiorno] = useState(giornoIniziale ?? oggiIso());
  const [w, setW] = useState(undefined);        // undefined = sto leggendo
  const [gara, setGara] = useState([]);
  const [variante, setVariante] = useState(null);
  const [scrivo, setScrivo] = useState(false);
  const [errore, setErrore] = useState("");

  const posso = puoScrivereWod(profilo);

  const carica = useCallback(async () => {
    setErrore("");
    setW(undefined);
    try {
      const trovato = await wodDelGiorno(giorno);
      setW(trovato);
      setVariante(trovato ? primaVariante(trovato.varianti) : null);
      setGara(trovato ? await leggiClassifica(giorno) : []);
    } catch {
      setW(null);
      setErrore("Non riesco a leggere il WOD.");
    }
  }, [giorno]);

  useEffect(() => { carica(); }, [carica]);

  if (scrivo) {
    return (
      <Redazione
        giorno={giorno}
        wod={w}
        onIndietro={() => setScrivo(false)}
        onSalvato={async (messaggio) => {
          setScrivo(false);
          onMessaggio(messaggio);
          await carica();
        }}
      />
    );
  }

  const varianti = w?.varianti ?? {};
  const presenti = VARIANTI.filter((v) => varianti[v]);

  return (
    <div className="px-5 pb-28 pt-1 relative overflow-hidden">
      <Montagna className="absolute right-[-3.5rem] top-0 w-64 h-64 text-neutral-800/55 pointer-events-none" />

      <div className="flex items-center justify-between min-h-10">
        {/* Aperta dalla barra in basso non ha un "indietro": è già
            una delle sezioni. */}
        {onIndietro ? (
          <button
            onClick={onIndietro}
            aria-label="Indietro"
            className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <span />
        )}
        {posso && (
          <button
            onClick={() => setScrivo(true)}
            className="text-[11px] font-semibold text-neutral-300 border border-neutral-700 rounded-full px-3.5 py-1.5 flex items-center gap-1.5"
          >
            <Pencil size={12} />
            {w ? "MODIFICA" : "SCRIVI"}
          </button>
        )}
      </div>

      {/* Il giorno */}
      <div className="flex items-center justify-between mt-3 mb-6 relative">
        <button
          onClick={() => setGiorno(piuGiorni(giorno, -1))}
          aria-label="Giorno precedente"
          className="w-9 h-9 flex items-center justify-center text-neutral-500"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-[12.5px] text-neutral-300 first-letter:uppercase">
            {dataEstesa(giorno)}
          </div>
          {giorno !== oggiIso() && (
            <button
              onClick={() => setGiorno(oggiIso())}
              className="text-[10px] text-neutral-600 underline underline-offset-2 mt-0.5"
            >
              torna a oggi
            </button>
          )}
        </div>
        <button
          onClick={() => setGiorno(piuGiorni(giorno, 1))}
          aria-label="Giorno successivo"
          className="w-9 h-9 flex items-center justify-center text-neutral-500"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {errore && <div className="mb-5"><Avviso>{errore}</Avviso></div>}

      {w === undefined ? (
        <div className="h-40 rounded-2xl bg-neutral-900 animate-pulse" />
      ) : !w ? (
        <Vuoto>
          Nessun WOD per questo giorno.
          {posso && <><br />Puoi scriverlo dal bottone qui sopra.</>}
        </Vuoto>
      ) : (
        <>
          {/* Titolo */}
          <div className="relative mb-5">
            <div className="text-[2.1rem] leading-none font-display font-bold text-neutral-50 uppercase">
              {w.titolo}
            </div>
            <div className="flex items-center gap-3 mt-2.5 text-[11px] text-neutral-500">
              <span className="tracking-wider font-semibold uppercase">
                {w.tipo_score === "tempo" ? "A TEMPO"
                 : w.tipo_score === "carico" ? "A CARICO" : "A RIPETIZIONI"}
              </span>
              {w.time_cap && (
                <span className="flex items-center gap-1">
                  <Timer size={11} /> cap {w.time_cap}
                </span>
              )}
            </div>
          </div>

          {/* Riscaldamento: solo staff */}
          {w.warm_up && (
            <Card className="mb-4 border-neutral-800">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={12} className="text-neutral-500" />
                <span className="text-[10px] tracking-[0.15em] text-neutral-500 font-semibold">
                  RISCALDAMENTO · SOLO STAFF
                </span>
              </div>
              <div className="text-[12.5px] text-neutral-300 whitespace-pre-line leading-relaxed">
                {w.warm_up}
              </div>
            </Card>
          )}

          {/* Versioni */}
          {presenti.length > 1 && (
            <div className="flex gap-2 mb-3">
              {presenti.map((v) => (
                <button
                  key={v}
                  onClick={() => setVariante(v)}
                  className={`flex-1 rounded-xl py-2 text-[11px] font-bold tracking-wider border transition-colors ${
                    variante === v
                      ? "bg-neutral-50 border-neutral-50 text-black"
                      : "border-neutral-800 text-neutral-400"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <Card className="mb-6">
            <div className="text-[15px] text-neutral-100 whitespace-pre-line leading-[1.7] font-medium">
              {varianti[variante] ?? ""}
            </div>
          </Card>

          <IlMioScore
            w={w}
            profilo={profilo}
            onFatto={async (messaggio) => {
              onMessaggio(messaggio);
              await carica();
            }}
          />

          {/* Classifica */}
          <Titolo>COME È ANDATA ({gara.length})</Titolo>
          {gara.length === 0 ? (
            <div className="text-[12px] text-neutral-600">
              Ancora nessun risultato.
            </div>
          ) : (
            <Card className="divide-y divide-neutral-800">
              {gara.map((r, i) => (
                <div key={r.profilo_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-5 text-[11px] text-neutral-600 tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <span className={`flex-1 text-[12.5px] truncate ${r.sono_io ? "text-neutral-50 font-semibold" : "text-neutral-300"}`}>
                    {r.nome} {r.cognome}
                    {r.sono_io && " (tu)"}
                  </span>
                  {r.privato && <Lock size={11} className="text-neutral-700 shrink-0" />}
                  <span className="text-[10px] text-neutral-600 shrink-0">{r.variante}</span>
                  <span className="text-[13px] font-display font-bold text-neutral-100 tabular-nums shrink-0 w-16 text-right">
                    {scriviScore(r.valore, w.tipo_score)}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function IlMioScore({ w, profilo, onFatto }) {
  const [apro, setApro] = useState(false);
  const [testo, setTesto] = useState(() => grezzo(w.mio_score, w.tipo_score));
  const [variante, setVariante] = useState(w.mia_variante ?? "RX");
  const [privato, setPrivato] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  const presenti = VARIANTI.filter((v) => w.varianti?.[v]);

  async function salva() {
    const valore = leggiScore(testo, w.tipo_score);
    if (valore == null) {
      setErrore(`Scrivi il risultato in ${unitaScore(w.tipo_score)}.`);
      return;
    }
    setErrore("");
    setLavoro(true);
    try {
      await salvaScore(w.wod_id, profilo.id, variante, valore, privato);
      setApro(false);
      await onFatto("Risultato salvato.");
    } catch {
      setErrore("Non è stato possibile salvare. Riprova fra poco.");
    }
    setLavoro(false);
  }

  async function togli() {
    setLavoro(true);
    try {
      await togliScore(w.wod_id, profilo.id);
      setApro(false);
      await onFatto("Risultato tolto.");
    } catch {
      setErrore("Non è stato possibile togliere il risultato.");
    }
    setLavoro(false);
  }

  if (!apro) {
    return (
      <button
        onClick={() => setApro(true)}
        className={`w-full rounded-2xl border p-4 mb-7 flex items-center text-left ${
          w.mio_score != null
            ? "border-neutral-400 bg-neutral-50/[0.07]"
            : "border-neutral-800 bg-neutral-900/70"
        }`}
      >
        <div className="flex-1">
          <div className="text-[10px] tracking-[0.15em] text-neutral-500 font-semibold mb-1">
            IL TUO RISULTATO
          </div>
          {w.mio_score != null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-[25px] font-display font-bold text-neutral-50 leading-none">
                {scriviScore(w.mio_score, w.tipo_score)}
              </span>
              <span className="text-[11px] text-neutral-500">{w.mia_variante}</span>
            </div>
          ) : (
            <div className="text-[13px] text-neutral-400">Non l'hai ancora messo.</div>
          )}
        </div>
        <ChevronRight size={16} className="text-neutral-600 shrink-0" />
      </button>
    );
  }

  return (
    <Card className="mb-7">
      <div className="text-[10px] tracking-[0.15em] text-neutral-500 font-semibold mb-3.5">
        IL TUO RISULTATO
      </div>

      {presenti.length > 1 && (
        <div className="flex gap-2 mb-3">
          {presenti.map((v) => (
            <button
              key={v}
              onClick={() => setVariante(v)}
              className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold tracking-wider border ${
                variante === v
                  ? "bg-neutral-50 border-neutral-50 text-black"
                  : "border-neutral-800 text-neutral-400"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      <input
        name="mio-risultato"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        inputMode={w.tipo_score === "tempo" ? "text" : "decimal"}
        placeholder={w.tipo_score === "tempo" ? "3:45" : w.tipo_score === "carico" ? "80" : "150"}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-3 text-[15px] text-neutral-50 placeholder:text-neutral-600 outline-none focus:border-neutral-600"
      />
      <div className="text-[10.5px] text-neutral-600 mt-1.5 mb-3">
        in {unitaScore(w.tipo_score)}
      </div>

      <label className="flex items-center gap-2.5 text-[11.5px] text-neutral-400 mb-4">
        <input
          type="checkbox"
          checked={privato}
          onChange={(e) => setPrivato(e.target.checked)}
          className="w-4 h-4 accent-neutral-200"
        />
        Tienilo per me: non compare agli altri
      </label>

      {errore && <div className="mb-3"><Avviso>{errore}</Avviso></div>}

      <div className="flex gap-2.5">
        <button
          onClick={() => setApro(false)}
          className="flex-1 rounded-xl border border-neutral-800 text-neutral-400 py-3 text-[12px] font-semibold"
        >
          ANNULLA
        </button>
        <div className="flex-1">
          <Bottone carica={lavoro} onClick={salva}>SALVA</Bottone>
        </div>
      </div>

      {w.mio_score != null && (
        <button
          onClick={togli}
          disabled={lavoro}
          className="w-full mt-3 text-[11px] text-neutral-600 underline underline-offset-2"
        >
          togli il mio risultato
        </button>
      )}
    </Card>
  );
}

function primaVariante(varianti) {
  return VARIANTI.find((v) => varianti?.[v]) ?? null;
}

function grezzo(valore, tipo) {
  if (valore == null) return "";
  return scriviScore(valore, tipo).replace(" kg", "");
}
