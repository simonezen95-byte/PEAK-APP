import { useEffect, useState } from "react";
import { Settings2, ChevronDown, AlertTriangle, RotateCcw } from "lucide-react";
import {
  annullaClasse, riapriClasse, cambiaCapienza, assegnaCoach,
  elencoCoach, spiega,
} from "../lib/classi";
import { Titolo, Avviso, Numeretto, Campo } from "./base";

/* Il pannello che lo staff trova in fondo a una lezione.

   Sta chiuso finché non serve: sono cose che si fanno una volta ogni
   tanto, e aperte di default occuperebbero mezza schermata sotto
   l'elenco degli iscritti, che è quello che si guarda sempre.

   L'annullamento sta in fondo e dietro una conferma: è l'unica azione
   qui dentro che manda una notifica a tutti e che non si annulla
   davvero, perché l'avviso è già partito. */

export default function GestioneClasse({ r, onCambiato, onMessaggio }) {
  const [aperto, setAperto] = useState(false);
  const [coach, setCoach] = useState(r.coach_id ?? "");
  const [posti, setPosti] = useState(String(r.capienza));
  const [elenco, setElenco] = useState([]);
  const [conferma, setConferma] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (!aperto) return;
    elencoCoach().then(setElenco).catch(() => setElenco([]));
  }, [aperto]);

  /* Dopo una modifica la schermata deve mostrare il nuovo stato
     subito. Invece di rileggere tutta la lezione dal database, ogni
     azione dice lei cos'è cambiato: sono due o tre campi, e li
     conosciamo già. */
  async function fai(azione, dopo, cambia) {
    setErrore("");
    setLavoro(true);
    try {
      const esito = await azione();
      onMessaggio(dopo(esito));
      onCambiato(typeof cambia === "function" ? cambia(esito) : cambia);
    } catch (e) {
      setErrore(spiega(e));
    }
    setLavoro(false);
  }

  const cambiatoCoach = (coach || null) !== (r.coach_id ?? null);
  const cambiatiPosti = Number(posti) !== r.capienza && Number(posti) >= 1;

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="w-full rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3 mt-7"
      >
        <Settings2 size={15} className="text-dettaglio shrink-0" strokeWidth={1.8} />
        <span className="text-[12.5px] text-neutral-300 flex-1 text-left">
          Gestisci la lezione
        </span>
        <ChevronDown size={15} className="text-spento shrink-0" />
      </button>
    );
  }

  return (
    <div className="mt-7">
      <Titolo>GESTISCI LA LEZIONE</Titolo>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {r.annullata ? (
        <>
          <div className="mb-3">
            <Avviso tono="nota">
              Questa lezione è annullata e chi era prenotato è stato avvisato.
              Rimettendola in programma <strong>le prenotazioni non tornano</strong>:
              chi c'era si sarà organizzato altrimenti, e riceverà un avviso
              per prenotare di nuovo se vuole.
            </Avviso>
          </div>
          <button
            onClick={() => fai(
              () => riapriClasse(r.sessione_id),
              (n) => n > 0
                ? `Lezione di nuovo in programma. Avvisati ${n} soci.`
                : "Lezione di nuovo in programma.",
              { annullata: false, motivo_annullo: null }
            )}
            disabled={lavoro}
            className="w-full rounded-xl border border-neutral-700 text-neutral-100 py-3.5 text-[13px] font-bold tracking-wide flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <RotateCcw size={15} />
            {lavoro ? "ATTENDI…" : "RIMETTI IN PROGRAMMA"}
          </button>
        </>
      ) : (
        <>
          {/* Coach */}
          <div className="mb-5">
            <div className="text-[11.5px] text-dettaglio mb-2">Coach</div>
            <div className="flex gap-2">
              <div className="flex-1 bg-scheda border border-bordo rounded-xl px-3.5 focus-within:border-neutral-600">
                <select
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                  className="w-full bg-transparent py-3.5 text-[14px] text-neutral-50 outline-none"
                >
                  <option value="">Nessuno</option>
                  {elenco.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cognome} {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              {cambiatoCoach && (
                <button
                  onClick={() => fai(
                    () => assegnaCoach(r.sessione_id, coach || null),
                    () => coach ? "Coach assegnato." : "Coach tolto.",
                    {
                      coach_id: coach || null,
                      coach: coach
                        ? (() => {
                            const c = elenco.find((x) => x.id === coach);
                            return c ? `${c.nome} ${c.cognome}`.trim() : null;
                          })()
                        : null,
                    }
                  )}
                  disabled={lavoro}
                  className="px-5 rounded-xl bg-neutral-50 text-black text-[12px] font-bold shrink-0 disabled:opacity-40"
                >
                  SALVA
                </button>
              )}
            </div>
            <div className="text-[10.5px] text-spento mt-1.5 leading-relaxed">
              Chi tiene la classe la chiude da solo a fine lezione, senza
              bisogno di essere amministratore.
            </div>
          </div>

          {/* Capienza */}
          <div className="mb-5">
            <div className="text-[11.5px] text-dettaglio mb-2">Posti</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Numeretto valore={posti} onCambia={setPosti} etichetta="posti" />
              </div>
              {cambiatiPosti && (
                <button
                  onClick={() => fai(
                    () => cambiaCapienza(r.sessione_id, Number(posti)),
                    (n) => n > 0
                      ? `Posti aggiornati. ${n === 1 ? "Un socio è entrato" : `${n} soci sono entrati`} dalla lista d'attesa.`
                      : "Posti aggiornati.",
                    (n) => ({
                      capienza: Number(posti),
                      iscritti: r.iscritti + n,
                      in_coda: Math.max(0, r.in_coda - n),
                    })
                  )}
                  disabled={lavoro}
                  className="px-5 rounded-xl bg-neutral-50 text-black text-[12px] font-bold shrink-0 disabled:opacity-40"
                >
                  SALVA
                </button>
              )}
            </div>
            <div className="text-[10.5px] text-spento mt-1.5 leading-relaxed">
              Aggiungendo posti entra chi è in lista d'attesa, e viene
              avvisato. Per toglierne sotto il numero degli iscritti,
              prima togli qualcuno dalla classe.
            </div>
          </div>

          {/* Annullare */}
          <div className="h-px bg-rilievo my-6" />

          {!conferma ? (
            <button
              onClick={() => setConferma(true)}
              className="w-full rounded-xl border border-bordo text-etichetta py-3.5 text-[12.5px] font-semibold flex items-center justify-center gap-2"
            >
              <AlertTriangle size={14} />
              ANNULLA LA LEZIONE
            </button>
          ) : (
            <div>
              <div className="mb-3">
                <Avviso tono="nota">
                  {r.iscritti > 0 || r.in_coda > 0 ? (
                    <>
                      <strong>
                        {r.iscritti + r.in_coda}{" "}
                        {r.iscritti + r.in_coda === 1 ? "socio riceverà" : "soci riceveranno"}{" "}
                        la notifica
                      </strong>{" "}
                      che la lezione non si terrà, e la loro prenotazione
                      verrà annullata. L'avviso parte subito e non si
                      richiama indietro.
                    </>
                  ) : (
                    "Non c'è nessun iscritto: non verrà avvisato nessuno."
                  )}
                </Avviso>
              </div>

              <div className="mb-3">
                <Campo
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo (facoltativo)"
                  autoFocus
                />
                <div className="text-[10.5px] text-spento mt-1.5 leading-relaxed">
                  Quello che scrivi finisce nella notifica. Una riga basta:
                  "il coach è malato", "chiusi per neve".
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setConferma(false); setMotivo(""); }}
                  className="flex-1 rounded-xl border border-bordo text-etichetta py-3.5 text-[12.5px] font-semibold"
                >
                  LASCIA STARE
                </button>
                <button
                  onClick={() => fai(
                    () => annullaClasse(r.sessione_id, motivo),
                    (n) => n > 0
                      ? `Lezione annullata. ${n === 1 ? "Un socio avvisato" : `${n} soci avvisati`}.`
                      : "Lezione annullata.",
                    {
                      annullata: true,
                      motivo_annullo: motivo.trim() || null,
                      iscritti: 0, in_coda: 0, mio_stato: null,
                    }
                  )}
                  disabled={lavoro}
                  className="flex-1 rounded-xl bg-red-900/70 border border-red-800 text-red-100 py-3.5 text-[12.5px] font-bold disabled:opacity-40"
                >
                  {lavoro ? "ATTENDI…" : "ANNULLA DAVVERO"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={() => { setAperto(false); setConferma(false); setErrore(""); }}
        className="w-full text-[11px] tracking-[0.1em] text-spento font-semibold py-4"
      >
        CHIUDI
      </button>
    </div>
  );
}
