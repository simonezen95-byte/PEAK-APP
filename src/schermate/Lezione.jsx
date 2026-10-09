import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Dumbbell, DoorOpen, Users, Check, Clock } from "lucide-react";
import { useSessione } from "../lib/sessione";
import { iscritti as leggiIscritti, prenota, disdici } from "../lib/prenotazioni";
import { dataEstesa, soloOra, piuMinuti, minutiAllInizio } from "../lib/date";
import { Card, Titolo, Avviso } from "../ui/base";

const MINUTI_PER_DISDIRE = 15;

/* Una lezione aperta: chi c'è, chi è in coda, e il bottone. */

export default function Lezione({ sessione, onIndietro, onCambiato, onMessaggio }) {
  const { profilo } = useSessione();
  const [gente, setGente] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const [r, setR] = useState(sessione);

  const carica = useCallback(async () => {
    try {
      setGente(await leggiIscritti(r.sessione_id));
    } catch {
      setGente([]);
    }
  }, [r.sessione_id]);

  useEffect(() => { carica(); }, [carica]);

  const dentro = r.mio_stato === "prenotato" || r.mio_stato === "presente";
  const inCoda = r.mio_stato === "lista_attesa";
  const liberi = Math.max(0, r.capienza - r.iscritti);
  const pieno = liberi === 0;
  const minuti = minutiAllInizio(r.data, r.ora);
  const passata = minuti < 0;
  const inTempoPerDisdire = minuti > MINUTI_PER_DISDIRE;

  const prenotati = (gente ?? []).filter((g) => g.stato !== "lista_attesa");
  const coda = (gente ?? []).filter((g) => g.stato === "lista_attesa");

  async function azione() {
    setErrore("");
    setLavoro(true);
    try {
      if (dentro || inCoda) {
        await disdici(r.sessione_id, profilo.id);
        setR((v) => ({
          ...v,
          mio_stato: null,
          mia_posizione: null,
          iscritti: dentro ? Math.max(0, v.iscritti - 1) : v.iscritti,
          in_coda: inCoda ? Math.max(0, v.in_coda - 1) : v.in_coda,
        }));
        onMessaggio(
          dentro ? "Prenotazione annullata. Il posto è libero." : "Sei uscito dalla lista d'attesa."
        );
      } else {
        const fatto = await prenota(r.sessione_id, profilo.id);
        const inLista = fatto.stato === "lista_attesa";
        setR((v) => ({
          ...v,
          mio_stato: fatto.stato,
          mia_posizione: fatto.posizione_coda,
          iscritti: inLista ? v.iscritti : v.iscritti + 1,
          in_coda: inLista ? v.in_coda + 1 : v.in_coda,
          posso: false,
        }));
        onMessaggio(
          inLista
            ? "Sei in lista d'attesa. Ti avvisiamo se si libera un posto."
            : "Prenotazione confermata."
        );
      }
      await carica();
      onCambiato();
    } catch (e) {
      setErrore(
        e?.tardi
          ? `Mancano meno di ${MINUTI_PER_DISDIRE} minuti all'inizio: la disdetta non è più possibile da qui. Avvisa lo staff.`
          : String(e?.message || "").includes("row-level security")
          ? "Non è possibile: controlla certificato, quota e abbonamento."
          : "Qualcosa non ha funzionato. Riprova fra poco."
      );
      await carica();
    }
    setLavoro(false);
  }

  const Icona = r.tipo === "classe" ? Dumbbell : DoorOpen;

  return (
    <div className="px-5 pb-40 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna al calendario"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      {/* Intestazione */}
      <div className="flex items-center gap-4 mt-2 mb-6">
        <div className="w-14 h-14 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
          <Icona size={21} className="text-neutral-300" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <div className="text-[21px] font-display font-bold text-neutral-50 leading-tight uppercase truncate">
            {r.nome}
          </div>
          <div className="text-[12px] text-neutral-500 first-letter:uppercase">{dataEstesa(r.data)}</div>
          <div className="text-[11.5px] text-neutral-400 mt-0.5">
            {soloOra(r.ora)} – {piuMinuti(r.ora, r.durata_min)}
            {r.coach && <span className="text-neutral-600"> · {r.coach}</span>}
          </div>
        </div>
      </div>

      {r.annullata ? (
        <Avviso>
          Questa lezione è stata annullata.
          {r.motivo_annullo ? ` ${r.motivo_annullo}` : ""}
        </Avviso>
      ) : (
        <>
          {/* Posti */}
          <Card className="mb-4 flex items-center">
            <div className="flex-1 flex items-center gap-3">
              <Users size={17} className="text-neutral-500" />
              <div>
                <div className="text-[19px] font-display font-bold text-neutral-50 leading-none">
                  {r.iscritti}
                  <span className="text-neutral-600 text-[15px] font-medium"> / {r.capienza}</span>
                </div>
                <div className="text-[10.5px] text-neutral-500 mt-1">prenotati</div>
              </div>
            </div>
            <div className="w-px self-stretch bg-neutral-800 mx-3" />
            <div className="flex-1 text-center">
              <div className="text-[19px] font-display font-bold text-neutral-50 leading-none">
                {pieno ? r.in_coda : liberi}
              </div>
              <div className="text-[10.5px] text-neutral-500 mt-1">
                {pieno ? "in lista d'attesa" : "posti liberi"}
              </div>
            </div>
          </Card>

          {dentro && (
            <Nota icona={Check}>
              {passata
                ? "Questa lezione è già cominciata."
                : inTempoPerDisdire
                ? `Sei prenotato. Puoi disdire fino a ${MINUTI_PER_DISDIRE} minuti prima dell'inizio.`
                : `Mancano meno di ${MINUTI_PER_DISDIRE} minuti: non è più possibile disdire da qui. Avvisa lo staff se non puoi venire.`}
            </Nota>
          )}

          {inCoda && (
            <Nota icona={Clock}>
              Sei in lista d'attesa, posizione{" "}
              <span className="text-neutral-50 font-semibold">{r.mia_posizione}</span>. Se
              si libera un posto entri in automatico e ricevi una notifica.
            </Nota>
          )}

          {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

          {/* Chi c'è */}
          <div className="mt-7">
            <Titolo>PRENOTATI</Titolo>
            {gente === null ? (
              <div className="h-20 rounded-2xl bg-neutral-900 animate-pulse" />
            ) : prenotati.length === 0 ? (
              <div className="text-[12px] text-neutral-600 mb-6">Ancora nessuno.</div>
            ) : (
              <div className="grid grid-cols-4 gap-x-2 gap-y-5 mb-7">
                {prenotati.map((g) => (
                  <Faccia key={g.id} socio={g.socio} io={g.profilo_id === profilo.id} />
                ))}
              </div>
            )}
          </div>

          {coda.length > 0 && (
            <>
              <div className="h-px bg-neutral-800 mb-6" />
              <Titolo>IN CODA ({coda.length})</Titolo>
              <div className="flex flex-col gap-2 mb-6">
                {coda.map((g, i) => (
                  <div key={g.id} className="flex items-center gap-3 text-[12.5px]">
                    <span className="w-5 text-neutral-600 tabular-nums">{i + 1}.</span>
                    <span className={g.profilo_id === profilo.id ? "text-neutral-50 font-semibold" : "text-neutral-400"}>
                      {nome(g.socio)}
                      {g.profilo_id === profilo.id && " (tu)"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Il bottone */}
          {/* Appoggiato sopra la barra in basso, che su iPhone è più
              alta per via della zona sotto lo schermo. */}
          <div
            className="fixed left-0 right-0 px-5 pb-3 pt-6 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D] to-transparent"
            style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-md mx-auto">
              <Bottone
                stato={
                  passata ? "passata"
                  : dentro && !inTempoPerDisdire ? "tardi"
                  : dentro ? "disdici"
                  : inCoda ? "esci"
                  : !r.posso ? "bloccato"
                  : pieno ? "coda"
                  : "prenota"
                }
                lavoro={lavoro}
                onClick={azione}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Bottone({ stato, lavoro, onClick }) {
  const mappa = {
    passata:  { testo: "LEZIONE PASSATA", spento: true },
    tardi:    { testo: "NON PIÙ DISDICIBILE", spento: true },
    bloccato: { testo: "NON PRENOTABILE", spento: true },
    disdici:  { testo: "DISDICI", chiaro: false },
    esci:     { testo: "ESCI DALLA LISTA D'ATTESA", chiaro: false },
    coda:     { testo: "ENTRA IN LISTA D'ATTESA", chiaro: true },
    prenota:  { testo: "PRENOTA", chiaro: true },
  };
  const v = mappa[stato];
  return (
    <button
      onClick={onClick}
      disabled={v.spento || lavoro}
      className={`w-full rounded-xl py-3.5 text-[13px] font-bold tracking-wide transition-colors disabled:opacity-30 ${
        v.chiaro
          ? "bg-neutral-50 text-black"
          : "border border-neutral-700 text-neutral-200"
      }`}
    >
      {lavoro ? "ATTENDI…" : v.testo}
    </button>
  );
}

function Nota({ icona: Icona, children }) {
  return (
    <Card className="mb-3 flex items-start gap-3">
      <Icona size={15} className="text-neutral-300 shrink-0 mt-0.5" strokeWidth={2.5} />
      <div className="text-[11.5px] text-neutral-400 leading-relaxed">{children}</div>
    </Card>
  );
}

function nome(socio) {
  if (!socio) return "Socio";
  return `${socio.nome} ${socio.cognome}`.trim();
}

function Faccia({ socio, io }) {
  const iniziali = socio
    ? `${socio.nome?.[0] ?? ""}${socio.cognome?.[0] ?? ""}`.toUpperCase()
    : "?";
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`w-13 h-13 rounded-full border flex items-center justify-center mb-2 overflow-hidden ${
          io ? "border-neutral-300" : "border-neutral-700"
        }`}
        style={{ width: 52, height: 52 }}
      >
        {socio?.foto_url ? (
          <img src={socio.foto_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[13px] font-display font-bold text-neutral-400">
            {iniziali}
          </span>
        )}
      </div>
      <div className="text-[10.5px] text-neutral-300 leading-tight">
        <div>{socio?.nome ?? "Socio"}</div>
        <div className="text-neutral-500">{io ? "(tu)" : socio?.cognome}</div>
      </div>
    </div>
  );
}
