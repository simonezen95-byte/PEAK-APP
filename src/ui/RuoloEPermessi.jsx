import { useState } from "react";
import { ShieldCheck, ChevronDown, Check } from "lucide-react";
import {
  RUOLI, PERMESSI, cambiaRuolo, cambiaPermessi,
  valeOggi, daRuolo, spiega,
} from "../lib/ruoli";
import { Titolo, Avviso } from "./base";

/* Ruolo e permessi di una persona. Lo vede solo il titolare.

   Il ruolo decide quasi tutto: i permessi uno per uno servono ai casi
   storti — un coach a cui si lascia anche scrivere il WOD, un admin a
   cui si toglie il listino. Per questo stanno dietro un secondo
   tocco: nove volte su dieci basta scegliere il ruolo e chiudere.

   Le spunte partono da come stanno le cose adesso, non vuote: così si
   vede subito cosa cambia e cosa no. */

export default function RuoloEPermessi({ s, onCambiato, onMessaggio }) {
  const [aperto, setAperto] = useState(false);
  const [fini, setFini] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  const scelto = RUOLI.find((x) => x.chiave === s.ruolo) ?? RUOLI[0];

  async function metti(ruolo) {
    if (ruolo === s.ruolo) return;
    setErrore("");
    setLavoro(true);
    try {
      await cambiaRuolo(s.id, ruolo);
      onCambiato({ ruolo, permessi: {} });
      onMessaggio(
        `${s.nome} adesso è ${RUOLI.find((x) => x.chiave === ruolo).nome.toLowerCase()}.`
      );
    } catch (e) {
      setErrore(spiega(e));
    }
    setLavoro(false);
  }

  async function spunta(chiave, eDiCoach) {
    setErrore("");
    const adesso = valeOggi(s, chiave, eDiCoach);
    const nuovo = !adesso;
    const scritti = { ...(s.permessi ?? {}) };

    // Se il ruolo da solo dà già la risposta giusta, la riga scritta a
    // mano non serve: si toglie, invece di lasciare un doppione che
    // poi confonde chi la rilegge.
    if (daRuolo(s.ruolo, eDiCoach) === nuovo) delete scritti[chiave];
    else scritti[chiave] = nuovo;

    setLavoro(true);
    try {
      await cambiaPermessi(s.id, scritti);
      onCambiato({ permessi: scritti });
    } catch (e) {
      setErrore(spiega(e));
    }
    setLavoro(false);
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="w-full rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3 mb-6"
      >
        <ShieldCheck size={15} className="text-neutral-500 shrink-0" strokeWidth={1.8} />
        <span className="text-[12.5px] text-neutral-300 flex-1 text-left">
          Ruolo e permessi
        </span>
        <span className="text-[11.5px] text-neutral-500 shrink-0">{scelto.nome}</span>
        <ChevronDown size={15} className="text-neutral-600 shrink-0" />
      </button>
    );
  }

  return (
    <div className="mb-6">
      <Titolo>RUOLO</Titolo>

      {errore && <div className="mb-3"><Avviso>{errore}</Avviso></div>}

      <div className="flex flex-col gap-2 mb-4">
        {RUOLI.map((v) => (
          <button
            key={v.chiave}
            onClick={() => metti(v.chiave)}
            disabled={lavoro}
            aria-pressed={s.ruolo === v.chiave}
            className={`rounded-2xl border p-3.5 text-left flex items-start gap-3 disabled:opacity-50 ${
              s.ruolo === v.chiave
                ? "border-neutral-400 bg-neutral-50/[0.07]"
                : "border-bordo bg-scheda"
            }`}
          >
            <div
              className={`w-[18px] h-[18px] rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                s.ruolo === v.chiave ? "border-neutral-50" : "border-neutral-600"
              }`}
            >
              {s.ruolo === v.chiave && <div className="w-2.5 h-2.5 rounded-full bg-neutral-50" />}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] text-neutral-100">{v.nome}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                {v.spiega}
              </div>
            </div>
          </button>
        ))}
      </div>

      {s.ruolo === "owner" ? (
        <div className="text-[11px] text-neutral-600 leading-relaxed mb-4">
          Un titolare può tutto: non c'è niente da aggiungere o togliere.
        </div>
      ) : !fini ? (
        <button
          onClick={() => setFini(true)}
          className="w-full rounded-xl border border-bordo text-neutral-400 py-3 text-[11.5px] font-semibold mb-4"
        >
          PERMESSI UNO PER UNO
        </button>
      ) : (
        <div className="mb-4">
          <div className="text-[11px] text-neutral-600 leading-relaxed mb-4">
            Servono ai casi storti: dare a un coach qualcosa in più, o
            togliere a un admin qualcosa. Quello che il ruolo dà già è
            spuntato; cambiandolo resta scritto come eccezione.
          </div>

          {PERMESSI.map((g) => (
            <div key={g.gruppo} className="mb-4">
              <div className="text-[10px] tracking-[0.15em] text-neutral-600 font-semibold mb-2">
                {g.gruppo.toUpperCase()}
              </div>
              <div className="rounded-2xl border border-bordo bg-scheda divide-y divide-filo">
                {g.voci.map((v) => {
                  const acceso = valeOggi(s, v.chiave, v.coach);
                  const normale = daRuolo(s.ruolo, v.coach);
                  return (
                    <button
                      key={v.chiave}
                      onClick={() => spunta(v.chiave, v.coach)}
                      disabled={lavoro}
                      role="switch"
                      aria-checked={acceso}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left disabled:opacity-50"
                    >
                      <div
                        className={`w-[18px] h-[18px] rounded border shrink-0 flex items-center justify-center ${
                          acceso ? "bg-neutral-50 border-neutral-50" : "border-neutral-600"
                        }`}
                      >
                        {acceso && <Check size={12} className="text-black" strokeWidth={4} />}
                      </div>
                      <span className="text-[12.5px] text-neutral-200 flex-1">{v.nome}</span>
                      {acceso !== normale && (
                        <span className="text-[9px] tracking-wider text-neutral-500 font-semibold shrink-0">
                          ECCEZIONE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => { setAperto(false); setFini(false); setErrore(""); }}
        className="w-full text-[11px] tracking-[0.1em] text-neutral-600 font-semibold py-3"
      >
        CHIUDI
      </button>
    </div>
  );
}
