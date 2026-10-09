import { useCallback, useEffect, useState } from "react";
import {
  Dumbbell, DoorOpen, Clock, Check, Calendar, Flame, CalendarCheck,
} from "lucide-react";
import { useSessione } from "../lib/sessione";
import { mieProssime, mioAccesso, mieStatistiche, ostacoli } from "../lib/prenotazioni";
import { wodDelGiorno, puoScrivereWod, VARIANTI } from "../lib/wod";
import { quando, soloOra, piuMinuti, dataBreve, aData, oggiIso } from "../lib/date";
import { Card, Sezione, Scheletro, Montagna, Numero } from "../ui/base";

/* La prima schermata: chi sei, cosa hai in programma, come stai andando
   e cosa ti manca. */

export default function Home({ onVaiAlCalendario, onVaiAlProfilo, onVaiAlWod, ricarica }) {
  const { profilo } = useSessione();
  const [prossime, setProssime] = useState(null);
  const [accesso, setAccesso] = useState(null);
  const [numeri, setNumeri] = useState(null);
  const [wod, setWod] = useState(undefined);

  const carica = useCallback(async () => {
    try {
      const [p, a, n, w] = await Promise.all([
        mieProssime(profilo.id),
        mioAccesso(),
        mieStatistiche(profilo.id),
        wodDelGiorno(oggiIso()),
      ]);
      setProssime(p);
      setAccesso(a);
      setNumeri(n);
      setWod(w);
    } catch {
      setProssime([]);
    }
  }, [profilo.id]);

  useEffect(() => { carica(); }, [carica, ricarica]);

  const blocchi = ostacoli(accesso, oggiIso());
  const puoScrivere = puoScrivereWod(profilo);
  const prima = prossime?.[0];

  return (
    <div className="px-5 pb-28 pt-3 relative overflow-hidden">
      <Montagna className="absolute -right-5 -top-2 w-36 h-36 text-neutral-900 pointer-events-none" />

      {/* Chi sei */}
      <div className="relative mb-2">
        <div className="text-[10.5px] tracking-[0.2em] text-neutral-500 font-semibold">
          {saluto()}
        </div>
        <div className="text-[2.3rem] leading-[1.03] font-display font-bold text-neutral-50 uppercase mt-1">
          {profilo.nome}
        </div>
        <div className="w-9 h-[3px] bg-neutral-50 my-3.5" />
        <div className="text-[9.5px] tracking-[0.25em] text-neutral-600 font-semibold">
          FOCUS. TRAIN. IMPROVE. REPEAT.
        </div>
      </div>

      {/* Cosa manca */}
      {blocchi.length > 0 && (
        <div className="mt-6 flex flex-col gap-2.5">
          {blocchi.map((b) => (
            <Card key={b.titolo} className="border-amber-900/50 bg-amber-950/20">
              <div className="text-[13px] font-semibold text-amber-200 mb-1">{b.titolo}</div>
              <div className="text-[11.5px] text-amber-200/60 leading-relaxed">{b.testo}</div>
            </Card>
          ))}
        </div>
      )}

      {/* La prossima */}
      <Sezione titolo="LA PROSSIMA" azione={onVaiAlCalendario} etichetta="CALENDARIO" />
      {prossime === null ? (
        <Scheletro righe={1} />
      ) : prima ? (
        <button
          onClick={onVaiAlCalendario}
          className="w-full text-left rounded-2xl border border-neutral-400 bg-neutral-50/[0.07] p-4 flex items-center"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] text-neutral-500 mb-0.5 first-letter:uppercase">
              {quando(prima.data)}
            </div>
            <div className="text-[31px] font-display font-bold text-neutral-50 leading-none">
              {soloOra(prima.ora)}
            </div>
            <div className="text-[10px] tracking-[0.15em] text-neutral-400 mt-2 font-semibold uppercase truncate">
              {prima.nome}
            </div>
            <span
              className={`inline-flex items-center gap-1 mt-3 text-[9.5px] font-bold tracking-wider rounded-full px-2.5 py-1 ${
                prima.stato === "lista_attesa"
                  ? "border border-neutral-600 text-neutral-300"
                  : "bg-neutral-50 text-black"
              }`}
            >
              {prima.stato === "lista_attesa" ? (
                <><Clock size={10} strokeWidth={3} /> IN CODA {prima.posizione_coda ?? ""}</>
              ) : (
                <><Check size={10} strokeWidth={3} /> PRENOTATO</>
              )}
            </span>
          </div>
          <div className="w-px self-stretch bg-neutral-800 mx-3.5" />
          <div className="text-center shrink-0 px-1">
            <div className="text-[19px] font-display font-bold text-neutral-50 leading-none">
              {piuMinuti(prima.ora, prima.durata_min)}
            </div>
            <div className="text-[9px] tracking-[0.12em] text-neutral-600 mt-1.5 font-semibold leading-tight">
              FINE<br />LEZIONE
            </div>
          </div>
        </button>
      ) : (
        <Card>
          <div className="text-[13px] text-neutral-300 mb-1">Non hai prenotazioni attive.</div>
          <button
            onClick={onVaiAlCalendario}
            className="text-[12px] text-neutral-400 underline underline-offset-2"
          >
            Prenota la tua prossima sessione
          </button>
        </Card>
      )}

      {/* Il WOD di oggi */}
      <Sezione titolo="IL WOD DI OGGI" azione={onVaiAlWod} etichetta="APRI" />
      {wod === undefined ? (
        <Scheletro righe={1} />
      ) : !wod ? (
        // Si apre lo stesso: di là lo staff lo scrive, e chiunque può
        // guardare gli altri giorni.
        <button onClick={onVaiAlWod} className="w-full text-left">
          <Card>
            <div className="text-[13px] text-neutral-400">
              Oggi non c'è ancora un WOD.
            </div>
            <div className="text-[11px] text-neutral-600 mt-1">
              {puoScrivere ? "Aprilo per scriverlo." : "Lo pubblica lo staff: ricontrolla più tardi."}
            </div>
          </Card>
        </button>
      ) : (
        <button onClick={onVaiAlWod} className="w-full text-left">
          <Card className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
              <Dumbbell size={17} className="text-neutral-300" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-display font-bold text-neutral-50 leading-tight uppercase truncate">
                {wod.titolo}
              </div>
              <div className="text-[11.5px] text-neutral-400 mt-1.5 leading-relaxed line-clamp-3 whitespace-pre-line">
                {anteprima(wod)}
              </div>
            </div>
          </Card>
        </button>
      )}

      {/* In programma */}
      {prossime !== null && prossime.length > 1 && (
        <>
          <Sezione titolo="IN PROGRAMMA" />
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
        </>
      )}

      {/* I tuoi numeri */}
      {numeri && (
        <>
          <Sezione titolo="I TUOI NUMERI" />
          <Card className="!p-0 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-neutral-800">
              <Numero icona={Flame} valore={numeri.mese} nome="QUESTO MESE" />
              <Numero icona={CalendarCheck} valore={numeri.inArrivo} nome="IN PROGRAMMA" />
              <Numero icona={Calendar} valore={numeri.totale} nome="IN TOTALE" />
            </div>
          </Card>
        </>
      )}

      {/* Abbonamento */}
      {accesso && (
        <>
          <Sezione titolo="LA TUA SITUAZIONE" azione={onVaiAlProfilo} etichetta="PROFILO" />
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
              allarme={!accesso.abbonamento}
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
        </>
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

/** Le prime righe della versione RX: quel tanto che basta a capire
    se oggi si tira o si corre. */
function anteprima(wod) {
  const prima = VARIANTI.map((v) => wod.varianti?.[v]).find(Boolean) ?? "";
  return prima.split("\n").slice(0, 3).join("\n");
}

function saluto() {
  const h = new Date().getHours();
  if (h < 12) return "BUONGIORNO,";
  if (h < 18) return "BUON POMERIGGIO,";
  return "BUONASERA,";
}
