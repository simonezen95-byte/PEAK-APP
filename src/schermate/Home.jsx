import { useCallback, useEffect, useState } from "react";
import { Dumbbell, DoorOpen, Clock, Check, ChevronRight } from "lucide-react";
import { useSessione } from "../lib/sessione";
import { mieProssime, mioAccesso, ostacoli } from "../lib/prenotazioni";
import { quando, soloOra, piuMinuti, dataBreve, aData, oggiIso } from "../lib/date";
import { Card, Titolo, Scheletro, Vuoto } from "../ui/base";

/* La prima schermata: cosa hai in programma e cosa ti manca. */

export default function Home({ onVaiAlCalendario, ricarica }) {
  const { profilo } = useSessione();
  const [prossime, setProssime] = useState(null);
  const [accesso, setAccesso] = useState(null);

  const carica = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([mieProssime(profilo.id), mioAccesso()]);
      setProssime(p);
      setAccesso(a);
    } catch {
      setProssime([]);
    }
  }, [profilo.id]);

  useEffect(() => { carica(); }, [carica, ricarica]);

  const blocchi = ostacoli(accesso, oggiIso());
  const prima = prossime?.[0];

  return (
    <div className="px-5 pb-28 pt-4">
      <div className="mb-7">
        <div className="text-[11px] tracking-[0.15em] text-neutral-500 font-semibold">
          {saluto()}
        </div>
        <div className="text-[25px] font-display font-bold text-neutral-50 leading-tight mt-1">
          {profilo.nome}
        </div>
      </div>

      {/* La prossima */}
      {prossime === null ? (
        <Scheletro righe={1} />
      ) : prima ? (
        <button
          onClick={onVaiAlCalendario}
          className="w-full text-left rounded-2xl border border-neutral-400 bg-neutral-50/[0.07] p-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            {prima.stato === "lista_attesa" ? (
              <Clock size={12} className="text-neutral-300" />
            ) : (
              <Check size={12} className="text-neutral-100" strokeWidth={3} />
            )}
            <span className="text-[10px] tracking-[0.15em] font-bold text-neutral-300">
              {prima.stato === "lista_attesa"
                ? `IN LISTA D'ATTESA · POSIZIONE ${prima.posizione_coda ?? "–"}`
                : "LA TUA PROSSIMA"}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-[27px] font-display font-bold text-neutral-50 leading-none">
              {soloOra(prima.ora)}
            </div>
            <div className="text-[12px] text-neutral-400 pb-0.5">
              – {piuMinuti(prima.ora, prima.durata_min)}
            </div>
          </div>
          <div className="text-[13px] text-neutral-200 mt-2">
            {prima.nome} · <span className="text-neutral-400">{quando(prima.data)}</span>
          </div>
        </button>
      ) : (
        <Card className="mb-6">
          <div className="text-[13px] text-neutral-300 mb-1">Non hai prenotazioni attive.</div>
          <button
            onClick={onVaiAlCalendario}
            className="text-[12px] text-neutral-400 underline underline-offset-2"
          >
            Prenota la tua prossima sessione
          </button>
        </Card>
      )}

      {/* Cosa manca */}
      {blocchi.length > 0 && (
        <div className="mb-7 flex flex-col gap-2.5">
          {blocchi.map((b) => (
            <Card key={b.titolo} className="border-amber-900/50 bg-amber-950/20">
              <div className="text-[13px] font-semibold text-amber-200 mb-1">{b.titolo}</div>
              <div className="text-[11.5px] text-amber-200/60 leading-relaxed">{b.testo}</div>
            </Card>
          ))}
        </div>
      )}

      {/* In programma */}
      {prossime !== null && prossime.length > 1 && (
        <section className="mb-7">
          <Titolo>IN PROGRAMMA</Titolo>
          <div className="flex flex-col gap-2.5">
            {prossime.slice(1).map((p) => (
              <div
                key={p.id ?? `${p.data}-${p.ora}`}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3.5 flex items-center gap-3.5"
              >
                {p.tipo === "classe" ? (
                  <Dumbbell size={16} className="text-neutral-500 shrink-0" strokeWidth={1.5} />
                ) : (
                  <DoorOpen size={16} className="text-neutral-500 shrink-0" strokeWidth={1.5} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-neutral-100 truncate">{p.nome}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 first-letter:uppercase">
                    {quando(p.data)} · {soloOra(p.ora)}
                  </div>
                </div>
                {p.stato === "lista_attesa" && (
                  <span className="text-[9.5px] font-bold tracking-wider border border-neutral-700 text-neutral-400 rounded-full px-2 py-0.5 shrink-0">
                    IN CODA
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Abbonamento */}
      {accesso && (
        <section>
          <Titolo>LA TUA SITUAZIONE</Titolo>
          <Card className="divide-y divide-neutral-800">
            <Voce
              nome="Abbonamento"
              valore={accesso.abbonamento ?? "nessuno"}
              nota={
                accesso.abbonamento_fine
                  ? `fino al ${dataBreve(accesso.abbonamento_fine)}${
                      accesso.residui != null ? ` · ${accesso.residui} ingressi` : ""
                    }`
                  : null
              }
            />
            <Voce
              nome="Certificato medico"
              valore={accesso.certificato_scadenza ? "valido" : "mancante"}
              nota={
                accesso.certificato_scadenza
                  ? `fino al ${dataBreve(accesso.certificato_scadenza)}`
                  : null
              }
              allarme={!accesso.certificato_scadenza}
            />
            <Voce
              nome="Quota associativa"
              valore={accesso.quota_fino ? "versata" : "da versare"}
              nota={accesso.quota_fino ? `stagione ${aData(accesso.quota_fino).getFullYear()}` : null}
              allarme={!accesso.quota_fino}
            />
          </Card>
        </section>
      )}
    </div>
  );
}

function Voce({ nome, valore, nota, allarme }) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="text-[12.5px] text-neutral-400">{nome}</div>
      <div className="text-right">
        <div className={`text-[12.5px] ${allarme ? "text-amber-300" : "text-neutral-100"}`}>
          {valore}
        </div>
        {nota && <div className="text-[10.5px] text-neutral-600 mt-0.5">{nota}</div>}
      </div>
    </div>
  );
}

function saluto() {
  const h = new Date().getHours();
  if (h < 12) return "BUONGIORNO";
  if (h < 18) return "BUON POMERIGGIO";
  return "BUONASERA";
}
