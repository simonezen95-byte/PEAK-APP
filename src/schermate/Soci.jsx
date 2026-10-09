import { useCallback, useEffect, useState } from "react";
import { Search, AlertTriangle, Check, ChevronRight } from "lucide-react";
import { elencoSoci } from "../lib/staff";
import { Scheletro, Vuoto, Avviso } from "../ui/base";

/* L'elenco della reception. In cima chi aspetta di essere approvato:
   è la cosa che va fatta per prima. */

const FILTRI = [
  { chiave: "tutti",     nome: "Tutti" },
  { chiave: "attesa",    nome: "In attesa" },
  { chiave: "problemi",  nome: "Da sistemare" },
];

export default function Soci({ onApri, ricarica }) {
  const [cerca, setCerca] = useState("");
  const [filtro, setFiltro] = useState("tutti");
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async (testo) => {
    setErrore("");
    try {
      setRighe(await elencoSoci(testo));
    } catch {
      setRighe([]);
      setErrore("Non riesco a leggere l'elenco dei soci.");
    }
  }, []);

  // Aspetto che smetta di scrivere prima di interrogare il database.
  useEffect(() => {
    const t = setTimeout(() => carica(cerca.trim()), cerca ? 300 : 0);
    return () => clearTimeout(t);
  }, [cerca, carica, ricarica]);

  const visibili = (righe ?? []).filter((r) =>
    filtro === "attesa"   ? r.stato === "in_attesa"
  : filtro === "problemi" ? r.stato === "approvato" && !r.in_regola
  : true
  );

  const inAttesa = (righe ?? []).filter((r) => r.stato === "in_attesa").length;

  return (
    <div className="px-5 pb-28 pt-4">
      <div className="text-[21px] font-display font-bold text-neutral-50 mb-4">
        Soci
      </div>

      <div className="flex items-center gap-2.5 bg-scheda border border-bordo rounded-xl px-3.5 mb-4 focus-within:border-neutral-600">
        <Search size={16} className="text-neutral-600 shrink-0" />
        <input
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca per nome o email"
          className="flex-1 min-w-0 bg-transparent py-3 text-[14px] text-neutral-50 placeholder:text-neutral-600 outline-none"
        />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto -mx-5 px-5 pb-1">
        {FILTRI.map((f) => (
          <button
            key={f.chiave}
            onClick={() => setFiltro(f.chiave)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold border transition-colors ${
              filtro === f.chiave
                ? "bg-neutral-50 border-neutral-50 text-black"
                : "border-bordo text-neutral-400"
            }`}
          >
            {f.nome}
            {f.chiave === "attesa" && inAttesa > 0 && ` · ${inAttesa}`}
          </button>
        ))}
      </div>

      {errore && <div className="mb-5"><Avviso>{errore}</Avviso></div>}

      {righe === null ? (
        <Scheletro righe={5} />
      ) : visibili.length === 0 ? (
        <Vuoto>
          {cerca
            ? "Nessun socio con questo nome."
            : filtro === "attesa"
            ? "Nessuna iscrizione da approvare."
            : filtro === "problemi"
            ? "Tutti in regola."
            : "Ancora nessun socio."}
        </Vuoto>
      ) : (
        <div className="flex flex-col gap-2">
          {visibili.map((s) => (
            <Riga key={s.id} s={s} onApri={() => onApri(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Riga({ s, onApri }) {
  const attesa = s.stato === "in_attesa";
  const sospeso = s.stato === "sospeso";

  return (
    <button
      onClick={onApri}
      className={`w-full rounded-2xl border p-3.5 flex items-center gap-3.5 text-left ${
        attesa
          ? "border-neutral-400 bg-neutral-50/[0.07]"
          : "border-bordo bg-scheda"
      }`}
    >
      <div className="w-10 h-10 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
        <span className="text-[12px] font-display font-bold text-neutral-400">
          {(s.nome?.[0] ?? "") + (s.cognome?.[0] ?? "")}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-neutral-100 font-semibold truncate">
          {s.cognome} {s.nome}
        </div>
        <div className="text-[11px] mt-0.5 truncate">
          {attesa ? (
            <span className="text-neutral-300">da approvare</span>
          ) : sospeso ? (
            <span className="text-neutral-500">sospeso</span>
          ) : s.in_regola ? (
            <span className="text-neutral-500">{s.abbonamento}</span>
          ) : (
            <span className="text-amber-300/80">{manca(s)}</span>
          )}
        </div>
      </div>

      {!attesa && !sospeso && (
        s.in_regola
          ? <Check size={15} className="text-neutral-500 shrink-0" strokeWidth={2.5} />
          : <AlertTriangle size={15} className="text-amber-400/70 shrink-0" />
      )}
      <ChevronRight size={16} className="text-neutral-700 shrink-0" />
    </button>
  );
}

function manca(s) {
  const oggi = new Date().toISOString().slice(0, 10);
  const pezzi = [];
  if (!s.certificato_scadenza || s.certificato_scadenza < oggi) pezzi.push("certificato");
  if (!s.quota_fino || s.quota_fino < oggi) pezzi.push("quota");
  if (!s.abbonamento) pezzi.push("abbonamento");
  if (pezzi.length === 0) return "da verificare";
  return `manca: ${pezzi.join(", ")}`;
}
