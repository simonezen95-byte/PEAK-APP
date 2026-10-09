import { Eye, EyeOff } from "lucide-react";

/* Pezzi comuni a tutte le schermate di accesso. */

export function Logo({ altezza = 56 }) {
  return (
    <img
      src="/logo-peak.png"
      alt="PEAK Functional Fitness"
      style={{ height: altezza, width: "auto" }}
      className="object-contain"
    />
  );
}

export function Campo({
  icona: Icona,
  tipo = "text",
  mostraOcchio,
  visibile,
  onOcchio,
  ...resto
}) {
  return (
    <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 focus-within:border-neutral-600">
      {Icona && <Icona size={17} className="text-neutral-500 shrink-0" />}
      <input
        {...resto}
        type={mostraOcchio ? (visibile ? "text" : "password") : tipo}
        className="flex-1 min-w-0 bg-transparent py-3.5 text-[15px] text-neutral-50 placeholder:text-neutral-600 outline-none"
      />
      {mostraOcchio && (
        <button
          type="button"
          onClick={onOcchio}
          aria-label={visibile ? "Nascondi la password" : "Mostra la password"}
          className="text-neutral-500 shrink-0 p-1"
        >
          {visibile ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      )}
    </div>
  );
}

export function Bottone({ variante = "pieno", carica, children, ...resto }) {
  const stile =
    variante === "pieno"
      ? "bg-neutral-50 text-black hover:bg-white"
      : "border border-neutral-700 text-neutral-100 hover:border-neutral-500";

  return (
    <button
      {...resto}
      disabled={resto.disabled || carica}
      className={`w-full rounded-xl py-3.5 text-[13.5px] font-bold tracking-wide transition-colors disabled:opacity-40 ${stile}`}
    >
      {carica ? "ATTENDI…" : children}
    </button>
  );
}

export function Avviso({ tono = "errore", children }) {
  if (!children) return null;
  const stile =
    tono === "errore"
      ? "bg-red-950/50 border-red-900/60 text-red-300"
      : "bg-neutral-900 border-neutral-800 text-neutral-300";
  return (
    <div className={`border rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed ${stile}`}>
      {children}
    </div>
  );
}

export function Spunta({ attiva, onChange, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <button
        type="button"
        onClick={onChange}
        role="checkbox"
        aria-checked={attiva}
        className={`w-[18px] h-[18px] rounded border shrink-0 mt-0.5 flex items-center justify-center ${
          attiva ? "bg-neutral-50 border-neutral-50" : "border-neutral-600"
        }`}
      >
        {attiva && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      <div className="text-[11.5px] text-neutral-400 leading-relaxed flex-1">{children}</div>
    </div>
  );
}

/** Data di nascita a tre tendine: un calendario costringerebbe a
    scorrere indietro di trent'anni, e un campo libero lascerebbe
    scrivere ogni data in un formato diverso. */
export function DataNascita({ valore, onChange }) {
  const parti = (valore || "").split("-");
  const g = parti[2] ? String(Number(parti[2])) : "";
  const m = parti[1] ? String(Number(parti[1])) : "";
  const a = parti[0] || "";

  const mesi = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  const quest_anno = new Date().getFullYear();
  const anni = [];
  for (let y = quest_anno - 12; y >= quest_anno - 90; y--) anni.push(y);
  const giorniNelMese = m && a ? new Date(Number(a), Number(m), 0).getDate() : 31;

  function aggiorna(next) {
    // Se cambiando mese o anno il giorno non esiste più (31 aprile,
    // 29 febbraio fuori dai bisestili) lo riporto all'ultimo valido.
    if (next.g && next.m && next.a) {
      const max = new Date(Number(next.a), Number(next.m), 0).getDate();
      if (Number(next.g) > max) next.g = String(max);
    }
    onChange(
      next.g && next.m && next.a
        ? `${next.a}-${String(next.m).padStart(2, "0")}-${String(next.g).padStart(2, "0")}`
        : ""
    );
  }

  const stile =
    "bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-3.5 text-[15px] text-neutral-50 outline-none appearance-none focus:border-neutral-600";

  return (
    <div>
      <div className="text-[11px] text-neutral-500 mb-2 ml-1">Data di nascita</div>
      <div className="grid grid-cols-[1fr_1.3fr_1.2fr] gap-2">
        <select value={g} onChange={(e) => aggiorna({ g: e.target.value, m, a })} className={stile}>
          <option value="">Giorno</option>
          {Array.from({ length: giorniNelMese }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={m} onChange={(e) => aggiorna({ g, m: e.target.value, a })} className={stile}>
          <option value="">Mese</option>
          {mesi.map((nome, i) => (
            <option key={nome} value={i + 1}>{nome}</option>
          ))}
        </select>
        <select value={a} onChange={(e) => aggiorna({ g, m, a: e.target.value })} className={stile}>
          <option value="">Anno</option>
          {anni.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
