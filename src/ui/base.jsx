import { useId, useState } from "react";
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
    <div className="flex items-center gap-3 bg-scheda border border-bordo rounded-xl px-3.5 focus-within:border-neutral-600">
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
      : "bg-scheda border-bordo text-neutral-300";
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
  // Le tre tendine si ricordano da sole cosa hai scelto. Se dipendessero
  // dalla data completa, la prima scelta sparirebbe: finché mancano le
  // altre due la data non esiste ancora.
  const parti = (valore || "").split("-");
  const [g, setG] = useState(parti[2] ? String(Number(parti[2])) : "");
  const [m, setM] = useState(parti[1] ? String(Number(parti[1])) : "");
  const [a, setA] = useState(parti[0] || "");

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
    setG(next.g);
    setM(next.m);
    setA(next.a);
    onChange(
      next.g && next.m && next.a
        ? `${next.a}-${String(next.m).padStart(2, "0")}-${String(next.g).padStart(2, "0")}`
        : ""
    );
  }

  const stile =
    "bg-scheda border border-bordo rounded-xl px-3 py-3.5 text-[15px] text-neutral-50 outline-none appearance-none focus:border-neutral-600";

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

/* ----------------------------------------------------------------
   Pezzi comuni alle schermate interne.
   ---------------------------------------------------------------- */

export function Card({ className = "", ...resto }) {
  return (
    <div
      {...resto}
      className={`rounded-2xl border border-bordo bg-scheda p-4 ${className}`}
    />
  );
}

export function Titolo({ children }) {
  return (
    <div className="text-[11px] tracking-[0.15em] text-neutral-500 font-semibold mb-3">
      {children}
    </div>
  );
}

/** Rettangoli grigi al posto del contenuto mentre arriva dal database:
    la pagina non salta quando i dati compaiono. */
export function Scheletro({ righe = 3 }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: righe }, (_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-scheda animate-pulse" />
      ))}
    </div>
  );
}

export function Vuoto({ children }) {
  return (
    <div className="text-center text-[12.5px] text-neutral-600 py-10 leading-relaxed">
      {children}
    </div>
  );
}

/** Messaggio che compare in basso dopo un'azione e sparisce da solo. */
export function Messaggio({ testo }) {
  if (!testo) return null;
  return (
    <div className="fixed left-0 right-0 bottom-24 flex justify-center px-6 pointer-events-none z-30">
      <div className="bg-neutral-100 text-black text-[12.5px] font-semibold rounded-full px-5 py-2.5 shadow-lg max-w-sm text-center">
        {testo}
      </div>
    </div>
  );
}

/** Il segno della montagna: la stessa A del logo.

    Misurata sul mockup pixel per pixel, non stimata a occhio. Tre
    cose che sembravano esserci e non ci sono: il filo chiaro sul
    bordo, il velo dentro la V, il contorno. È una fascia sola,
    piatta, che sfuma verso il basso e un po' verso sinistra.

    Le misure, in punti: apice al centro, pendenza 0,71 in orizzontale
    per ogni punto in verticale, fascia spessa 41, apice interno 59
    punti più in basso. Il riquadro è in punti apposta, così i numeri
    presi dal mockup si leggono tali e quali. */
export function Montagna({ className = "" }) {
  // useId mette dei due punti nel nome, e url(#...) con i due punti
  // su Safari ogni tanto non lo segue: li tolgo.
  const id = `montagna${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden="true">
      <defs>
        {/* L'asse va dall'alto a destra, dov'è più chiara, al basso a
            sinistra, dove sparisce: nel mockup la gamba sinistra è
            più spenta della destra alla stessa altezza. */}
        <linearGradient id={id} x1="0.78" y1="0" x2="0.42" y2="1">
          <stop offset="0%"  stopColor="currentColor" stopOpacity="0.133" />
          <stop offset="40%" stopColor="currentColor" stopOpacity="0.078" />
          <stop offset="58%" stopColor="currentColor" stopOpacity="0.036" />
          <stop offset="75%" stopColor="currentColor" stopOpacity="0.016" />
          <stop offset="92%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M120 4 L243 182 L201 182 L120 63 L39 182 L-3 182 Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}

/** Titolo di sezione con, a destra, il rimando al resto. */
export function Sezione({ titolo, azione, etichetta = "VEDI TUTTO" }) {
  return (
    <div className="flex items-center justify-between mt-7 mb-3">
      <div className="text-[11px] tracking-[0.15em] text-neutral-400 font-semibold">
        {titolo}
      </div>
      {azione && (
        <button
          onClick={azione}
          className="text-[10.5px] text-neutral-500 flex items-center gap-0.5 font-semibold tracking-wider"
        >
          {etichetta}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Un numero grande con sotto cosa vuol dire. */
export function Numero({ icona: Icona, valore, nome, nota }) {
  return (
    <div className="flex flex-col items-center text-center py-4 px-2">
      {Icona && <Icona size={17} className="text-neutral-400 mb-2" strokeWidth={1.8} />}
      <div className="text-[22px] font-display font-bold text-neutral-50 leading-none">
        {valore}
      </div>
      <div className="text-[9px] tracking-[0.12em] text-neutral-500 mt-1.5 font-semibold">
        {nome}
      </div>
      {nota && <div className="text-[9px] text-neutral-700 mt-1">{nota}</div>}
    </div>
  );
}

/** Icona dentro un cerchio: è il modo in cui il marchio presenta le
    cose, dal logo in giù. */
export function Cerchio({ icona: Icona, misura = 44, pieno = false }) {
  return (
    <div
      style={{ width: misura, height: misura }}
      className={`rounded-full flex items-center justify-center shrink-0 ${
        pieno ? "bg-rilievo" : "border border-neutral-700"
      }`}
    >
      <Icona size={Math.round(misura * 0.4)} className="text-neutral-300" strokeWidth={1.6} />
    </div>
  );
}

/** Il filo verticale che divide una scheda in due parti. */
export function Divisore() {
  return <div className="w-px self-stretch bg-rilievo mx-3.5" />;
}

/** Bottone piccolo dentro una scheda. */
export function BottonePiccolo({ chiaro, children, ...resto }) {
  return (
    <button
      {...resto}
      className={`rounded-xl px-3.5 py-2.5 text-[10.5px] font-bold tracking-[0.08em] whitespace-nowrap flex items-center gap-1 ${
        chiaro
          ? "bg-neutral-100 text-black"
          : "border border-neutral-700 text-neutral-200"
      }`}
    >
      {children}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

/** La fiamma della serie.

    Accesa e con l'alone quando la settimana in corso è già
    alimentata, spenta e vuota quando è ancora aperta: si deve capire
    a colpo d'occhio se manca qualcosa da fare, non solo quante
    settimane hai messo insieme.

    Sotto, una tacca per settimana: piene quelle fatte, l'ultima
    pulsa finché resta da alimentare. */
export function Fiamma({ accesa, settimane = [] }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          accesa ? "bg-neutral-100" : "bg-rilievo"
        }`}
        style={accesa ? { boxShadow: "0 0 16px 1px rgba(255,255,255,0.18)" } : undefined}
      >
        <svg
          width={accesa ? 19 : 17} height={accesa ? 19 : 17} viewBox="0 0 24 24"
          fill={accesa ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={accesa ? 1 : 1.8}
          strokeLinecap="round" strokeLinejoin="round"
          className={accesa ? "text-black" : "text-neutral-500"}
        >
          <path d="M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-2-1-5 1-8z" />
        </svg>
      </div>

      {settimane.length > 0 && (
        <div className="flex items-end gap-[3px] mt-2.5 h-[9px]">
          {settimane.map((s) => (
            <span
              key={s.inizio}
              title={`${s.quanti} allenamenti`}
              className={`w-[3px] rounded-full ${
                s.fatta
                  ? s.in_corso ? "bg-neutral-100 h-[9px]" : "bg-neutral-400 h-[7px]"
                  : s.in_corso
                  ? "bg-neutral-600 h-[9px] animate-pulse"
                  : "bg-neutral-800 h-[4px]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
