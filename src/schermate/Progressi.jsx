import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Plus, TrendingUp, Flame, Calendar, CalendarCheck, Trash2 } from "lucide-react";
import { useSessione } from "../lib/sessione";
import {
  mieiMassimali, storicoMassimale, storicoWod, mieiAllenamenti,
  esercizi as leggiEsercizi, salvaMassimale, togliMassimale, aggiungiEsercizio,
  TIPI_MASSIMALE, kg,
} from "../lib/progressi";
import { scriviScore } from "../lib/wod";
import { dataBreve, oggiIso } from "../lib/date";
import { Card, Sezione, Numero, Scheletro, Vuoto, Avviso, Bottone, Montagna } from "../ui/base";

/* I progressi: quanto ti alleni, quanto sollevi, come vanno i WOD. */

export default function Progressi({ onIndietro, onMessaggio }) {
  const { profilo } = useSessione();
  const [vista, setVista] = useState("massimali");
  const [numeri, setNumeri] = useState(null);
  const [massimali, setMassimali] = useState(null);
  const [wod, setWod] = useState(null);
  const [aggiungo, setAggiungo] = useState(false);
  const [aperto, setAperto] = useState(null);     // massimale aperto nello storico

  const carica = useCallback(async () => {
    try {
      const [n, m, w] = await Promise.all([
        mieiAllenamenti(), mieiMassimali(), storicoWod(),
      ]);
      setNumeri(n);
      setMassimali(m);
      setWod(w);
    } catch {
      setMassimali([]);
      setWod([]);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  if (aggiungo) {
    return (
      <Aggiungi
        profilo={profilo}
        onIndietro={() => setAggiungo(false)}
        onSalvato={async (messaggio) => {
          setAggiungo(false);
          onMessaggio(messaggio);
          await carica();
        }}
      />
    );
  }

  return (
    <div className="px-5 pb-28 pt-3 relative overflow-hidden">
      <Montagna className="absolute right-[-35px] top-[0px] w-[240px] h-[190px] text-white pointer-events-none" />

      {onIndietro && (
        <button
          onClick={onIndietro}
          aria-label="Indietro"
          className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      <h1 className="text-[25px] font-display font-bold text-neutral-50 relative mt-1 mb-5">
        Progressi
      </h1>

      {/* Quanto ti alleni */}
      {numeri && (
        <Card className="!p-0 overflow-hidden mb-2">
          <div className="grid grid-cols-3 divide-x divide-filo">
            <Numero icona={Flame} valore={numeri.questo_mese} nome="QUESTO MESE" />
            <Numero icona={CalendarCheck} valore={numeri.in_programma} nome="IN PROGRAMMA" />
            <Numero icona={Calendar} valore={numeri.totale} nome="IN TOTALE" />
          </div>
        </Card>
      )}
      {numeri?.dal && (
        <div className="text-[10.5px] text-neutral-600 text-center mb-6">
          dal {dataBreve(numeri.dal)}
        </div>
      )}

      {/* Massimali o WOD */}
      <div className="flex gap-2 mb-5">
        {[["massimali", "MASSIMALI"], ["wod", "RISULTATI WOD"]].map(([k, nome]) => (
          <button
            key={k}
            onClick={() => setVista(k)}
            className={`flex-1 rounded-xl py-2.5 text-[11px] font-bold tracking-wider border transition-colors ${
              vista === k
                ? "bg-neutral-50 border-neutral-50 text-black"
                : "border-bordo text-neutral-400"
            }`}
          >
            {nome}
          </button>
        ))}
      </div>

      {vista === "massimali" ? (
        <>
          <button
            onClick={() => setAggiungo(true)}
            className="w-full rounded-xl border border-neutral-700 text-neutral-200 py-3 text-[12px] font-semibold flex items-center justify-center gap-2 mb-5"
          >
            <Plus size={14} />
            REGISTRA UN MASSIMALE
          </button>

          {massimali === null ? (
            <Scheletro righe={3} />
          ) : massimali.length === 0 ? (
            <Vuoto>
              Non hai ancora registrato nessun massimale.
              <br />
              Comincia da quelli che conosci: si aggiornano col tempo.
            </Vuoto>
          ) : (
            Object.entries(raggruppa(massimali)).map(([categoria, righe]) => (
              <div key={categoria} className="mb-5">
                <Sezione titolo={categoria.toUpperCase()} />
                <Card className="divide-y divide-filo">
                  {righe.map((r) => (
                    <Massimale
                      key={`${r.esercizio_id}-${r.tipo}`}
                      r={r}
                      aperto={aperto === `${r.esercizio_id}-${r.tipo}`}
                      onApri={() =>
                        setAperto(
                          aperto === `${r.esercizio_id}-${r.tipo}`
                            ? null
                            : `${r.esercizio_id}-${r.tipo}`
                        )
                      }
                      onCambiato={async (messaggio) => {
                        onMessaggio(messaggio);
                        await carica();
                      }}
                    />
                  ))}
                </Card>
              </div>
            ))
          )}
        </>
      ) : wod === null ? (
        <Scheletro righe={3} />
      ) : wod.length === 0 ? (
        <Vuoto>
          Nessun risultato registrato.
          <br />
          Si inseriscono dalla sezione WOD, dopo l'allenamento.
        </Vuoto>
      ) : (
        <Card className="divide-y divide-filo">
          {wod.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-neutral-100 uppercase truncate">{r.titolo}</div>
                <div className="text-[10.5px] text-neutral-600 mt-0.5">
                  {dataBreve(r.data)} · {r.variante}
                  {r.su_quanti > 1 && ` · ${r.posizione}° su ${r.su_quanti}`}
                </div>
              </div>
              <div className="text-[15px] font-display font-bold text-neutral-50 tabular-nums shrink-0">
                {scriviScore(r.valore, r.tipo_score)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Massimale({ r, aperto, onApri, onCambiato }) {
  const [storico, setStorico] = useState(null);

  useEffect(() => {
    if (!aperto) return;
    storicoMassimale(r.esercizio_id, r.tipo).then(setStorico).catch(() => setStorico([]));
  }, [aperto, r.esercizio_id, r.tipo]);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <button onClick={onApri} className="w-full flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-neutral-100 truncate">{r.esercizio}</div>
          <div className="text-[10.5px] text-neutral-600 mt-0.5">
            {r.tipo} · {dataBreve(r.data)}
            {r.quanti > 1 && ` · ${r.quanti} tentativi`}
          </div>
        </div>
        <div className="text-[17px] font-display font-bold text-neutral-50 tabular-nums shrink-0">
          {kg(r.valore)}
        </div>
      </button>

      {aperto && (
        <div className="mt-3 pt-3 border-t border-bordo/60">
          {storico === null ? (
            <div className="h-8 rounded-lg bg-scheda animate-pulse" />
          ) : (
            storico.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-1.5">
                <span className="text-[11.5px] text-neutral-500 w-20 shrink-0">
                  {dataBreve(s.data)}
                </span>
                <span className="flex-1 text-[12.5px] text-neutral-300 tabular-nums">
                  {kg(s.valore)}
                </span>
                <button
                  onClick={async () => {
                    await togliMassimale(s.id);
                    await onCambiato("Tentativo eliminato.");
                  }}
                  aria-label="Elimina questo tentativo"
                  className="text-neutral-700 p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Aggiungi({ profilo, onIndietro, onSalvato }) {
  const [lista, setLista] = useState(null);
  const [cerca, setCerca] = useState("");
  const [scelto, setScelto] = useState(null);
  const [tipo, setTipo] = useState("1RM");
  const [peso, setPeso] = useState("");
  const [data, setData] = useState(oggiIso());
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    leggiEsercizi().then(setLista).catch(() => setLista([]));
  }, []);

  const visibili = (lista ?? []).filter((e) =>
    e.nome.toLowerCase().includes(cerca.trim().toLowerCase())
  );
  const esisteGia = (lista ?? []).some(
    (e) => e.nome.toLowerCase() === cerca.trim().toLowerCase()
  );

  async function salva() {
    const n = Number(String(peso).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setErrore("Scrivi il peso in chili.");
      return;
    }
    setErrore("");
    setLavoro(true);
    try {
      await salvaMassimale(profilo.id, scelto.id, tipo, n, data);
      await onSalvato("Massimale registrato.");
    } catch {
      setErrore("Non è stato possibile salvare. Riprova fra poco.");
      setLavoro(false);
    }
  }

  async function creaEsercizio() {
    setLavoro(true);
    try {
      const nuovo = await aggiungiEsercizio(
        profilo.box_id, cerca, "Altro", profilo.id
      );
      setLista((p) => [...(p ?? []), nuovo]);
      setScelto(nuovo);
      setCerca("");
    } catch {
      setErrore("Non è stato possibile aggiungere l'esercizio.");
    }
    setLavoro(false);
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

      <h1 className="text-[20px] font-display font-bold text-neutral-50 mt-2 mb-5">
        Registra un massimale
      </h1>

      {!scelto ? (
        <>
          <input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca l'esercizio"
            autoComplete="off"
            autoCorrect="off"
            className="w-full bg-scheda border border-bordo rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 placeholder:text-neutral-600 outline-none focus:border-neutral-600 mb-4"
          />
          {lista === null ? (
            <Scheletro righe={4} />
          ) : (
            <>
              {cerca.trim() && !esisteGia && (
                <button
                  onClick={creaEsercizio}
                  disabled={lavoro}
                  className="w-full rounded-xl border border-dashed border-neutral-700 text-neutral-300 py-3 text-[12px] font-semibold mb-3 flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Aggiungi «{cerca.trim()}»
                </button>
              )}
              <Card className="divide-y divide-filo">
                {visibili.slice(0, 40).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setScelto(e)}
                    className="w-full flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-left"
                  >
                    <span className="text-[13px] text-neutral-200">{e.nome}</span>
                    <span className="text-[10.5px] text-neutral-600 shrink-0 ml-3">
                      {e.categoria}
                    </span>
                  </button>
                ))}
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          <Card className="mb-5 flex items-center">
            <div className="flex-1">
              <div className="text-[15px] text-neutral-50">{scelto.nome}</div>
              <div className="text-[10.5px] text-neutral-600 mt-0.5">{scelto.categoria}</div>
            </div>
            <button
              onClick={() => setScelto(null)}
              className="text-[11px] text-neutral-400 underline underline-offset-2 shrink-0"
            >
              cambia
            </button>
          </Card>

          <div className="text-[11px] text-neutral-400 font-semibold mb-2">Ripetizioni</div>
          <div className="flex gap-1.5 mb-5">
            {TIPI_MASSIMALE.map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 rounded-lg py-2 text-[11px] font-bold border ${
                  tipo === t
                    ? "bg-neutral-50 border-neutral-50 text-black"
                    : "border-bordo text-neutral-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-neutral-400 font-semibold mb-2">Peso</div>
          <div className="flex items-center gap-2.5 bg-scheda border border-bordo rounded-xl px-3.5 mb-5 focus-within:border-neutral-600">
            <input
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="100"
              className="flex-1 min-w-0 bg-transparent py-3 text-[15px] text-neutral-50 placeholder:text-neutral-600 outline-none"
            />
            <span className="text-neutral-600 text-[13px] shrink-0">kg</span>
          </div>

          <div className="text-[11px] text-neutral-400 font-semibold mb-2">Quando</div>
          <input
            type="date"
            value={data}
            max={oggiIso()}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-scheda border border-bordo rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 outline-none focus:border-neutral-600 mb-5"
          />

          {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

          <Bottone carica={lavoro} disabled={!peso} onClick={salva}>
            SALVA
          </Bottone>

          <p className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed text-center">
            Ogni tentativo resta con la sua data: in elenco compare il migliore,
            ma la storia non si perde.
          </p>
        </>
      )}
    </div>
  );
}

function raggruppa(righe) {
  const fuori = {};
  for (const r of righe) {
    (fuori[r.categoria] ??= []).push(r);
  }
  return fuori;
}
