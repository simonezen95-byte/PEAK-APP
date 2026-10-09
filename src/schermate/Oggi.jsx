import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, CalendarDays, DoorOpen, Dumbbell, Check } from "lucide-react";
import { useSessione } from "../lib/sessione";
import { numeriDiOggi, attivitaDiOggi, andamento, riempimento } from "../lib/cruscotto";
import { soloOra, piuMinuti, dataEstesa, oggiIso, aData } from "../lib/date";
import { Card, Sezione, Scheletro, Vuoto, Montagna } from "../ui/base";

/* La home di chi apre il box: cosa c'è oggi e cosa chiede attenzione. */

export default function Oggi({ onVaiAiSoci, onVaiAlleClassi, onVaiAlWod, ricarica }) {
  const { profilo } = useSessione();
  const [n, setN] = useState(null);
  const [attivita, setAttivita] = useState(null);
  const [settimana, setSettimana] = useState([]);

  const carica = useCallback(async () => {
    try {
      const [numeri, att, and_] = await Promise.all([
        numeriDiOggi(), attivitaDiOggi(), andamento(7),
      ]);
      setN(numeri);
      setAttivita(att);
      setSettimana(and_);
    } catch {
      setAttivita([]);
    }
  }, []);

  useEffect(() => { carica(); }, [carica, ricarica]);

  const pieno = riempimento(n);
  const prossime = (attivita ?? []).filter((a) => !a.passata && !a.annullata);
  const fatte = (attivita ?? []).filter((a) => a.passata);

  return (
    <div className="px-5 pb-28 pt-4 relative overflow-hidden">
      <Montagna className="absolute right-[-35px] top-[9px] w-[240px] h-[190px] text-white pointer-events-none" />

      <div className="relative mb-6">
        <div className="text-[10.5px] tracking-[0.2em] text-neutral-500 font-semibold">
          {saluto()}
        </div>
        <div className="text-[25px] font-display font-bold text-neutral-50 leading-tight mt-1">
          {profilo.nome}
        </div>
        <div className="text-[11.5px] text-neutral-500 mt-1.5 first-letter:uppercase">
          {dataEstesa(oggiIso())}
        </div>
      </div>

      {/* I numeri */}
      {n === null ? (
        <Scheletro righe={2} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 mb-2">
          <Riquadro
            icona={Users}
            valore={n.soci_in_regola}
            nome="Soci in regola"
            onClick={onVaiAiSoci}
          />
          <Riquadro
            icona={UserPlus}
            valore={n.da_approvare}
            nome="Da approvare"
            acceso={n.da_approvare > 0}
            onClick={onVaiAiSoci}
          />
          <Riquadro
            icona={CalendarDays}
            valore={n.classi_oggi}
            nome="Classi oggi"
            nota={pieno !== null ? `${pieno}% dei posti` : null}
            onClick={onVaiAlleClassi}
          />
          <Riquadro
            icona={DoorOpen}
            valore={n.openbox_oggi}
            nome="Open Box oggi"
            nota="prenotazioni"
            onClick={onVaiAlleClassi}
          />
        </div>
      )}

      {/* Oggi in palestra */}
      <Sezione titolo="OGGI IN PALESTRA" azione={onVaiAlleClassi} etichetta="CALENDARIO" />
      {attivita === null ? (
        <Scheletro righe={3} />
      ) : prossime.length === 0 ? (
        <Vuoto>
          {fatte.length > 0
            ? "Per oggi è tutto: non resta nessuna attività."
            : "Oggi non c'è niente in programma."}
        </Vuoto>
      ) : (
        <div className="flex flex-col gap-2.5">
          {prossime.slice(0, 6).map((a) => (
            <Attivita key={a.sessione_id} a={a} />
          ))}
        </div>
      )}

      {/* Andamento */}
      {settimana.length > 0 && (
        <>
          <Sezione titolo="PRENOTAZIONI, ULTIMI 7 GIORNI" />
          <Card>
            <Istogramma righe={settimana} />
          </Card>
        </>
      )}

      {/* WOD */}
      <Sezione titolo="IL WOD DI OGGI" azione={onVaiAlWod} etichetta="APRI" />
      <button onClick={onVaiAlWod} className="w-full text-left">
        <Card className="flex items-center gap-3.5">
          <Dumbbell size={16} className="text-neutral-500 shrink-0" strokeWidth={1.6} />
          <div className="text-[12.5px] text-neutral-300">
            Scrivi o modifica il WOD
          </div>
        </Card>
      </button>
    </div>
  );
}

function Riquadro({ icona: Icona, valore, nome, nota, acceso, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-3.5 text-left ${
        acceso
          ? "border-neutral-400 bg-neutral-50/[0.07]"
          : "border-bordo bg-scheda"
      }`}
    >
      <Icona size={15} className="text-neutral-500 mb-2.5" strokeWidth={1.8} />
      <div className="text-[23px] font-display font-bold text-neutral-50 leading-none">
        {valore}
      </div>
      <div className="text-[11px] text-neutral-400 mt-1.5">{nome}</div>
      {nota && <div className="text-[10px] text-neutral-600 mt-0.5">{nota}</div>}
    </button>
  );
}

function Attivita({ a }) {
  const liberi = Math.max(0, a.capienza - a.iscritti);
  return (
    <div className="rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3.5">
      <div className="shrink-0">
        <div className="text-[15px] font-display font-bold text-neutral-50 leading-none">
          {soloOra(a.ora)}
        </div>
        <div className="text-[9.5px] text-neutral-600 mt-1">
          {piuMinuti(a.ora, a.durata_min)}
        </div>
      </div>
      <div className="w-px self-stretch bg-rilievo" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-neutral-100 truncate">{a.nome}</div>
        <div className="text-[10.5px] text-neutral-500 mt-0.5 truncate">
          {a.coach ?? (a.tipo === "classe" ? "coach da assegnare" : "accesso libero")}
          {a.in_coda > 0 && ` · ${a.in_coda} in coda`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-semibold text-neutral-100 tabular-nums">
          {a.iscritti}<span className="text-neutral-600">/{a.capienza}</span>
        </div>
        <div className="text-[9.5px] text-neutral-600 mt-0.5">
          {liberi === 0 ? "pieno" : `${liberi} liberi`}
        </div>
      </div>
    </div>
  );
}

/* Una serie sola: niente legenda, il titolo sopra dice già cosa sono.
   Barre sottili, punta arrotondata, due pixel d'aria fra una e
   l'altra, e il valore solo sul giorno più alto. */
function Istogramma({ righe }) {
  const massimo = Math.max(1, ...righe.map((r) => r.quante));
  const piuAlto = righe.reduce((a, b) => (b.quante > a.quante ? b : a), righe[0]);

  return (
    <div>
      <div className="flex items-end gap-[2px] h-24">
        {righe.map((r) => {
          const altezza = Math.round((r.quante / massimo) * 100);
          const oggi = r.data === oggiIso();
          return (
            <div key={r.data} className="flex-1 flex flex-col items-center justify-end h-full">
              {r.quante > 0 && r.data === piuAlto.data && (
                <div className="text-[10px] text-neutral-300 font-semibold mb-1 tabular-nums">
                  {r.quante}
                </div>
              )}
              <div
                title={`${r.quante} prenotazioni`}
                className={`w-full max-w-[22px] rounded-t ${
                  oggi ? "bg-neutral-100" : "bg-neutral-700"
                }`}
                style={{ height: `${Math.max(altezza, r.quante > 0 ? 6 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-2 pt-2 border-t border-bordo">
        {righe.map((r) => (
          <div
            key={r.data}
            className={`flex-1 text-center text-[9.5px] ${
              r.data === oggiIso() ? "text-neutral-300 font-semibold" : "text-neutral-600"
            }`}
          >
            {["dom", "lun", "mar", "mer", "gio", "ven", "sab"][aData(r.data).getDay()]}
          </div>
        ))}
      </div>
    </div>
  );
}

function saluto() {
  const h = new Date().getHours();
  if (h < 12) return "BUONGIORNO,";
  if (h < 18) return "BUON POMERIGGIO,";
  return "BUONASERA,";
}
