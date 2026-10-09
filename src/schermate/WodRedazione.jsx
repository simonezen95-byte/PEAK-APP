import { useState } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";
import { salvaWod, cancellaWod, nomeTipo, VARIANTI } from "../lib/wod";
import { dataEstesa } from "../lib/date";
import { Avviso, Bottone } from "../ui/base";

/* Scrivere il WOD. I movimenti sono testo libero, una riga ciascuno:
   un coach scrive più in fretta di quanto scelga da un menù. */

const TIPI = ["tempo", "ripetizioni", "carico"];

export default function Redazione({ giorno, wod, onIndietro, onSalvato }) {
  const [titolo, setTitolo] = useState(wod?.titolo ?? "");
  const [tipo, setTipo] = useState(wod?.tipo_score ?? "tempo");
  const [timeCap, setTimeCap] = useState(wod?.time_cap ?? "");
  const [warmUp, setWarmUp] = useState(wod?.warm_up ?? "");
  const [varianti, setVarianti] = useState(() => ({
    RX:     wod?.varianti?.RX ?? "",
    SCALED: wod?.varianti?.SCALED ?? "",
    OPEN:   wod?.varianti?.OPEN ?? "",
  }));
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  const completo = titolo.trim() && varianti.RX.trim();

  async function salva() {
    setErrore("");
    setLavoro(true);
    try {
      await salvaWod(giorno, {
        titolo: titolo.trim(),
        tipo_score: tipo,
        time_cap: timeCap.trim(),
        warm_up: warmUp.trim(),
        varianti,
      });
      await onSalvato(wod ? "WOD aggiornato." : "WOD pubblicato.");
    } catch (e) {
      setErrore(
        String(e?.message || "").includes("permesso")
          ? "Non hai il permesso di scrivere il WOD."
          : "Non è stato possibile salvare. Riprova fra poco."
      );
      setLavoro(false);
    }
  }

  async function elimina() {
    setLavoro(true);
    try {
      await cancellaWod(giorno);
      await onSalvato("WOD eliminato.");
    } catch {
      setErrore("Non è stato possibile eliminare.");
      setLavoro(false);
    }
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <h1 className="text-[20px] font-display font-bold text-neutral-50 mt-2">
        {wod ? "Modifica il WOD" : "Scrivi il WOD"}
      </h1>
      <p className="text-[11.5px] text-neutral-500 mt-1 mb-6 first-letter:uppercase">
        {dataEstesa(giorno)}
      </p>

      <Campo nome="Titolo" nota="Come si chiama: FRAN, AMRAP 20', EMOM 12…">
        <input
          {...senzaAiuti}
          name="wod-titolo"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          placeholder="FRAN"
          className={stileCampo}
        />
      </Campo>

      <Campo nome="Come si misura" nota="Decide anche come si ordina la classifica.">
        <div className="flex gap-2">
          {TIPI.map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-xl py-2.5 text-[11px] font-bold tracking-wider border ${
                tipo === t
                  ? "bg-neutral-50 border-neutral-50 text-black"
                  : "border-neutral-800 text-neutral-400"
              }`}
            >
              {nomeTipo(t).replace("A ", "").toUpperCase()}
            </button>
          ))}
        </div>
      </Campo>

      <Campo nome="Time cap" nota="Lascia vuoto se non c'è.">
        <input
          {...senzaAiuti}
          name="wod-timecap"
          inputMode="numeric"
          value={timeCap}
          onChange={(e) => setTimeCap(e.target.value)}
          placeholder="12:00"
          className={stileCampo}
        />
      </Campo>

      {VARIANTI.map((v) => (
        <Campo
          key={v}
          nome={v === "RX" ? "RX · obbligatoria" : `${v} · facoltativa`}
          nota={v === "RX" ? "Un movimento per riga." : undefined}
        >
          <textarea
            {...senzaAiuti}
            name={`wod-${v.toLowerCase()}`}
            value={varianti[v]}
            onChange={(e) => setVarianti((p) => ({ ...p, [v]: e.target.value }))}
            rows={v === "RX" ? 6 : 4}
            placeholder={v === "RX" ? "21-15-9\nThruster 43 kg\nPull up" : ""}
            className={`${stileCampo} resize-y leading-relaxed`}
          />
        </Campo>
      ))}

      <Campo
        nome="Riscaldamento"
        nota="Compare sullo schermo in sala e qui nella console, mai nell'app dei soci."
      >
        <textarea
          {...senzaAiuti}
          name="wod-warmup"
          value={warmUp}
          onChange={(e) => setWarmUp(e.target.value)}
          rows={3}
          placeholder="500 m rowing&#10;2 giri di mobilità anche e spalle"
          className={`${stileCampo} resize-y leading-relaxed`}
        />
      </Campo>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <Bottone carica={lavoro} disabled={!completo} onClick={salva}>
        {wod ? "SALVA LE MODIFICHE" : "PUBBLICA"}
      </Bottone>

      {!completo && (
        <p className="text-[10.5px] text-neutral-600 mt-2.5 text-center">
          Servono almeno il titolo e la versione RX.
        </p>
      )}

      {wod && (
        <button
          onClick={elimina}
          disabled={lavoro}
          className="w-full mt-5 rounded-xl border border-neutral-800 text-neutral-500 py-3 text-[12px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Trash2 size={14} />
          ELIMINA IL WOD DI QUESTO GIORNO
        </button>
      )}
    </div>
  );
}

const stileCampo =
  "w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 placeholder:text-neutral-700 outline-none focus:border-neutral-600";

/* Il browser, se non gli si dice niente, prova a riempire i campi con
   quello che conosce: indirizzi, nomi, numeri di telefono. Qui dentro
   non c'entrano, e il correttore automatico rovinerebbe "AMRAP" e
   "Thruster". */
const senzaAiuti = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
};

function Campo({ nome, nota, children }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] text-neutral-400 font-semibold mb-1.5">{nome}</div>
      {children}
      {nota && <div className="text-[10.5px] text-neutral-600 mt-1.5 leading-relaxed">{nota}</div>}
    </div>
  );
}
