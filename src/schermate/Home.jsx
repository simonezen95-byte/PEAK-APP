import { useCallback, useEffect, useState } from "react";
import {
  Calendar, Dumbbell, DoorOpen, Clock, Check, Flame, CalendarCheck,
  Megaphone, TrendingUp,
} from "lucide-react";
import { useSessione } from "../lib/sessione";
import {
  mieProssime, mioAccesso, mieStatistiche, ostacoli, settimana as leggiSettimana,
} from "../lib/prenotazioni";
import { wodDelGiorno, puoScrivereWod, VARIANTI } from "../lib/wod";
import { comunicazioni as leggiComunicazioni, quantoFa } from "../lib/notifiche";
import {
  quando, soloOra, piuMinuti, dataBreve, aData, oggiIso, lunedi, minutiAllInizio,
} from "../lib/date";
import {
  Card, Sezione, Scheletro, Montagna, Cerchio, Divisore, BottonePiccolo,
} from "../ui/base";

/* La prima schermata del socio. */

export default function Home({ onVaiAlCalendario, onVaiAlProfilo, onVaiAlWod, onApriLezione, ricarica }) {
  const { profilo } = useSessione();
  const [prossime, setProssime] = useState(null);
  const [accesso, setAccesso] = useState(null);
  const [numeri, setNumeri] = useState(null);
  const [wod, setWod] = useState(undefined);
  const [libera, setLibera] = useState(null);   // la prossima classe prenotabile
  const [avvisi, setAvvisi] = useState([]);

  const carica = useCallback(async () => {
    try {
      const [p, a, n, w, c] = await Promise.all([
        mieProssime(profilo.id),
        mioAccesso(),
        mieStatistiche(profilo.id),
        wodDelGiorno(oggiIso()),
        leggiComunicazioni(3).catch(() => []),
      ]);
      setProssime(p);
      setAccesso(a);
      setNumeri(n);
      setWod(w);
      setAvvisi(c);

      // Se non hai niente prenotato, la scheda in alto propone la
      // prossima classe con ancora posto.
      if (p.length === 0) {
        const sett = await leggiSettimana(lunedi(oggiIso()));
        setLibera(
          sett.find(
            (s) =>
              s.tipo === "classe" &&
              !s.annullata &&
              minutiAllInizio(s.data, s.ora) > 0 &&
              s.iscritti < s.capienza
          ) ?? null
        );
      } else {
        setLibera(null);
      }
    } catch {
      setProssime([]);
    }
  }, [profilo.id]);

  useEffect(() => { carica(); }, [carica, ricarica]);

  const blocchi = ostacoli(accesso, oggiIso());
  const puoScrivere = puoScrivereWod(profilo);
  const prima = prossime?.[0];

  return (
    <div className="px-5 pb-28 pt-4 relative overflow-hidden">
      <Montagna className="absolute right-[-25px] top-[6px] w-[250px] h-[250px] text-white pointer-events-none" />

      {/* Chi sei */}
      <div className="relative mb-1">
        <div className="text-[11px] tracking-[0.22em] text-neutral-400 font-semibold">
          {saluto()}
        </div>
        <div className="text-[2.6rem] leading-[1.02] font-display font-bold text-neutral-50 uppercase mt-0.5">
          {profilo.nome}
        </div>
        <div className="w-10 h-[3px] bg-neutral-50 my-3.5" />
        <div className="text-[10px] tracking-[0.25em] text-neutral-500 font-semibold">
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
        <Card className="flex items-center">
          <Cerchio icona={prima.tipo === "classe" ? Calendar : DoorOpen} />
          <div className="flex-1 min-w-0 ml-3.5">
            <div className="text-[10.5px] text-neutral-500 first-letter:uppercase">
              {quando(prima.data)}
            </div>
            <div className="text-[30px] font-display font-bold text-neutral-50 leading-none mt-0.5">
              {soloOra(prima.ora)}
            </div>
            <div className="text-[10px] tracking-[0.18em] text-neutral-400 font-semibold uppercase mt-1.5 truncate">
              {prima.nome}
            </div>
          </div>
          <Divisore />
          <div className="shrink-0 text-right">
            {prima.stato === "lista_attesa" ? (
              <>
                <Clock size={15} className="text-neutral-300 inline-block mb-1" />
                <div className="text-[10px] tracking-[0.1em] text-neutral-500 font-semibold leading-tight">
                  IN CODA<br />POSIZIONE {prima.posizione_coda ?? "–"}
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1 text-[9.5px] font-bold tracking-[0.1em] bg-neutral-100 text-black rounded-full px-2.5 py-1 mb-2">
                  <Check size={10} strokeWidth={3} /> PRENOTATO
                </div>
                <div className="text-[10px] text-neutral-600 leading-tight">
                  fine {piuMinuti(prima.ora, prima.durata_min)}
                </div>
              </>
            )}
          </div>
        </Card>
      ) : libera ? (
        <Card className="flex items-center">
          <Cerchio icona={Calendar} />
          <div className="flex-1 min-w-0 ml-3.5">
            <div className="text-[10.5px] text-neutral-500 first-letter:uppercase">
              {quando(libera.data)}
            </div>
            <div className="text-[30px] font-display font-bold text-neutral-50 leading-none mt-0.5">
              {soloOra(libera.ora)}
            </div>
            <div className="text-[10px] tracking-[0.18em] text-neutral-400 font-semibold uppercase mt-1.5 truncate">
              {libera.nome}
            </div>
          </div>
          <Divisore />
          <div className="shrink-0 text-right">
            <div className="text-[15px] font-display font-bold text-neutral-50 leading-none tabular-nums">
              {libera.capienza - libera.iscritti}
              <span className="text-neutral-600"> / {libera.capienza}</span>
            </div>
            <div className="text-[9px] tracking-[0.1em] text-neutral-600 font-semibold mt-1 mb-2.5 leading-tight">
              POSTI<br />LIBERI
            </div>
            <BottonePiccolo chiaro onClick={() => onApriLezione(libera)}>
              PRENOTA
            </BottonePiccolo>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-[13px] text-neutral-300 mb-1">Non hai prenotazioni attive.</div>
          <button
            onClick={onVaiAlCalendario}
            className="text-[12px] text-neutral-400 underline underline-offset-2"
          >
            Apri il calendario
          </button>
        </Card>
      )}

      {/* Il WOD di oggi */}
      <Sezione titolo="IL WOD DI OGGI" azione={onVaiAlWod} etichetta="APRI" />
      {wod === undefined ? (
        <Scheletro righe={1} />
      ) : !wod ? (
        <button onClick={onVaiAlWod} className="w-full text-left">
          <Card className="flex items-center">
            <Cerchio icona={Dumbbell} />
            <div className="flex-1 ml-3.5">
              <div className="text-[13px] text-neutral-300">
                Oggi non c'è ancora un WOD.
              </div>
              <div className="text-[11px] text-neutral-600 mt-0.5">
                {puoScrivere ? "Aprilo per scriverlo." : "Lo pubblica lo staff."}
              </div>
            </div>
          </Card>
        </button>
      ) : (
        <Card className="flex items-center">
          <Cerchio icona={Dumbbell} />
          <Divisore />
          <div className="flex-1 min-w-0">
            <div className="text-[9.5px] tracking-[0.18em] text-neutral-500 font-semibold uppercase">
              {wod.tipo_score === "tempo" ? "FOR TIME"
               : wod.tipo_score === "carico" ? "A CARICO" : "A RIPETIZIONI"}
              {wod.time_cap && ` · CAP ${wod.time_cap}`}
            </div>
            <div className="text-[17px] font-display font-bold text-neutral-50 leading-tight uppercase mt-0.5 truncate">
              {capo(wod)}
            </div>
            <div className="text-[11.5px] text-neutral-400 leading-[1.5] mt-1 whitespace-pre-line">
              {corpo(wod)}
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <BottonePiccolo onClick={onVaiAlWod}>APRI</BottonePiccolo>
          </div>
        </Card>
      )}

      {/* In programma */}
      {prossime !== null && prossime.length > 1 && (
        <>
          <Sezione titolo="IN PROGRAMMA" />
          <div className="flex flex-col gap-2.5">
            {prossime.slice(1).map((p) => (
              <Card
                key={p.id ?? `${p.data}-${p.ora}`}
                className="flex items-center gap-3.5 !py-3"
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
              </Card>
            ))}
          </div>
        </>
      )}

      {/* I tuoi numeri */}
      {numeri && (
        <>
          <Sezione titolo="I TUOI NUMERI" azione={onVaiAlProfilo} etichetta="QUESTO MESE" />
          <Card className="!p-0 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-neutral-800">
              <Tassello icona={Flame} valore={numeri.mese} nome="QUESTO MESE" />
              <Tassello icona={CalendarCheck} valore={numeri.inArrivo} nome="IN PROGRAMMA" />
              <Tassello icona={TrendingUp} valore={numeri.totale} nome="IN TOTALE" />
            </div>
          </Card>
        </>
      )}

      {/* Dal box */}
      {avvisi.length > 0 && (
        <>
          <Sezione titolo="DAL BOX" />
          <div className="flex flex-col gap-2.5">
            {avvisi.map((a) => (
              <Card key={a.id} className="flex items-start gap-3.5">
                <Cerchio icona={Megaphone} misura={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-neutral-50">{a.titolo}</div>
                  <div className="text-[10px] text-neutral-600 mt-0.5">
                    {quantoFa(a.pubblicata_il)}
                  </div>
                  <div className="text-[11.5px] text-neutral-400 leading-relaxed mt-1.5">
                    {a.testo}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* La tua situazione */}
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

function Tassello({ icona: Icona, valore, nome }) {
  return (
    <div className="flex flex-col items-center text-center py-5 px-2">
      <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center mb-2.5">
        <Icona size={15} className="text-neutral-300" strokeWidth={1.8} />
      </div>
      <div className="text-[23px] font-display font-bold text-neutral-50 leading-none">
        {valore}
      </div>
      <div className="text-[9px] tracking-[0.12em] text-neutral-500 mt-1.5 font-semibold">
        {nome}
      </div>
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

/** La prima riga del WOD fa da titolo, le altre da sottotitolo. */
function righe(wod) {
  const testo = VARIANTI.map((v) => wod.varianti?.[v]).find(Boolean) ?? "";
  return testo.split("\n").filter((r) => r.trim());
}
function capo(wod) {
  return righe(wod)[0] ?? wod.titolo;
}
function corpo(wod) {
  return righe(wod).slice(1, 4).join("\n");
}

function saluto() {
  const h = new Date().getHours();
  if (h < 12) return "BUONGIORNO,";
  if (h < 18) return "BUON POMERIGGIO,";
  return "BUONASERA,";
}
