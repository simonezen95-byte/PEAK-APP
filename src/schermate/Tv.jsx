import { useCallback, useEffect, useState } from "react";
import { supabase, configurato } from "../lib/supabase";
import { Logo, Montagna } from "../ui/base";
import { dataEstesa, oggiIso } from "../lib/date";
import { VARIANTI } from "../lib/wod";

/* Lo schermo appeso in sala. Nessun accesso: la pagina conosce il
   codice della palestra e il database le dà il WOD del giorno e
   nient'altro — non gli archivi.

   È pensata per essere guardata da lontano e lasciata accesa: testo
   grande, niente da toccare, e si riaggiorna da sola. */

const OGNI_MINUTI = 5;

export default function Tv({ codice }) {
  const [dati, setDati] = useState(undefined);
  const [ora, setOra] = useState(() => new Date());

  const carica = useCallback(async () => {
    if (!configurato) { setDati(null); return; }
    const { data, error } = await supabase.rpc("wod_per_tv", {
      codice,
      giorno: oggiIso(),
    });
    setDati(error ? null : (data?.[0] ?? null));
  }, [codice]);

  useEffect(() => { carica(); }, [carica]);

  // Si riaggiorna da sola: lo schermo resta acceso tutto il giorno, e
  // a mezzanotte deve passare al WOD nuovo senza che nessuno tocchi
  // niente.
  useEffect(() => {
    const t = setInterval(carica, OGNI_MINUTI * 60 * 1000);
    return () => clearInterval(t);
  }, [carica]);

  useEffect(() => {
    const t = setInterval(() => setOra(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const orologio = `${String(ora.getHours()).padStart(2, "0")}:${String(ora.getMinutes()).padStart(2, "0")}`;
  const varianti = dati?.varianti ?? {};
  const presenti = VARIANTI.filter((v) => varianti[v]);

  return (
    <div className="min-h-full flex flex-col px-10 py-8 relative overflow-hidden">
      <Montagna className="absolute right-[-6rem] top-[-1rem] w-[46rem] h-[36.4rem] text-white pointer-events-none" />

      {/* Testata */}
      <header className="flex items-center justify-between relative shrink-0">
        <Logo altezza={44} />
        <div className="text-right">
          <div className="text-[2.6rem] font-display font-bold text-neutral-50 leading-none tabular-nums">
            {orologio}
          </div>
          <div className="text-[0.95rem] text-neutral-500 mt-1.5 first-letter:uppercase">
            {dataEstesa(oggiIso())}
          </div>
        </div>
      </header>

      {dati === undefined ? (
        <Centro><span className="text-neutral-700">…</span></Centro>
      ) : dati === null ? (
        <Centro>
          <div className="text-[1.4rem] text-neutral-500">Schermo non riconosciuto.</div>
          <div className="text-[1rem] text-neutral-700 mt-3">
            Controlla il codice nell'indirizzo.
          </div>
        </Centro>
      ) : !dati.titolo ? (
        <Centro>
          <Logo altezza={70} />
          <div className="text-[1.6rem] text-neutral-400 mt-10">
            Oggi nessun WOD in programma.
          </div>
        </Centro>
      ) : (
        <main className="flex-1 flex flex-col justify-center relative py-6 min-h-0">
          <div className="flex items-end gap-6 mb-2 flex-wrap">
            <h1 className="text-[clamp(3rem,9vw,7rem)] leading-[0.95] font-display font-bold text-neutral-50 uppercase">
              {dati.titolo}
            </h1>
            {dati.time_cap && (
              <div className="pb-3">
                <div className="text-[0.8rem] tracking-[0.2em] text-neutral-600 font-semibold">
                  TIME CAP
                </div>
                <div className="text-[2.2rem] font-display font-bold text-neutral-300 leading-none tabular-nums">
                  {dati.time_cap}
                </div>
              </div>
            )}
          </div>

          <div className="w-20 h-[4px] bg-neutral-50 mb-9" />

          <div
            className="grid gap-9 flex-1 min-h-0"
            style={{ gridTemplateColumns: `repeat(${Math.max(presenti.length, 1)}, minmax(0, 1fr))` }}
          >
            {presenti.map((v) => (
              <section key={v} className="min-w-0">
                <div className="text-[0.85rem] tracking-[0.28em] text-neutral-500 font-semibold mb-5">
                  {v}
                </div>
                <div
                  className="leading-[1.5] text-neutral-100 whitespace-pre-line font-medium"
                  style={{ fontSize: misura(presenti.length) }}
                >
                  {varianti[v]}
                </div>
              </section>
            ))}
          </div>

          {dati.warm_up && (
            <footer className="shrink-0 border-t border-filo pt-5 mt-8">
              <div className="text-[0.75rem] tracking-[0.25em] text-neutral-600 font-semibold mb-2">
                WARM UP
              </div>
              <div className="text-[1.15rem] text-neutral-400 whitespace-pre-line leading-relaxed">
                {dati.warm_up}
              </div>
            </footer>
          )}
        </main>
      )}
    </div>
  );
}

/** Quanto scrivere i movimenti. Con una versione sola c'è tutto lo
    schermo a disposizione e va sfruttato: questa pagina si guarda da
    in fondo alla sala, non da vicino. */
function misura(quante) {
  if (quante <= 1) return "clamp(2rem, 5.5vw, 4.6rem)";
  if (quante === 2) return "clamp(1.6rem, 3.4vw, 3rem)";
  return "clamp(1.3rem, 2.5vw, 2.2rem)";
}

function Centro({ children }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center relative">
      {children}
    </div>
  );
}
