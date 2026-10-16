import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Share, Check } from "lucide-react";
import { comeSiamo, accendi, spegni } from "../lib/push";

/* Il riquadro che accende le notifiche sul telefono.

   Il permesso del browser si può chiedere una volta sola: se il
   socio dice di no, l'app non può più richiederlo — solo lui può
   tornare indietro dalle impostazioni del telefono. Per questo qui
   si spiega prima a cosa servono e si chiede dopo, con un tocco.

   Cinque situazioni, cinque frasi diverse. "Il tuo telefono non può"
   e "hai detto di no" sembrano la stessa cosa e si rimediano in modi
   opposti, quindi non si possono raccontare con lo stesso messaggio. */

export default function AvvisiTelefono() {
  const [stato, setStato] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  const guarda = useCallback(async () => {
    setStato(await comeSiamo());
  }, []);

  useEffect(() => { guarda(); }, [guarda]);

  async function cambia() {
    setErrore("");
    setLavoro(true);
    try {
      if (stato === "accese") await spegni();
      else await accendi();
      await guarda();
    } catch (e) {
      const m = String(e?.message || "");
      setErrore(
        m === "negate"
          ? "Hai detto di no quando il telefono l'ha chiesto. Da qui non si può richiedere: si riattiva dalle impostazioni del telefono, alla voce di questa app."
          : m === "da-casa"
          ? "Su iPhone serve prima aggiungere l'app alla schermata Home."
          : "Non sono riuscito ad accendere le notifiche su questo telefono."
      );
      await guarda();
    }
    setLavoro(false);
  }

  if (stato === null) return null;

  // Questo browser non può, e non c'è niente da fare: meglio non
  // mostrare niente che un bottone che non funziona.
  if (stato === "impossibile") return null;

  /* iPhone aperto in Safari. Il bottone non servirebbe: prima va
     aggiunta alla Home. Si spiega come, perché è l'unico momento in
     cui la persona ha il problema davanti. */
  if (stato === "da-casa") {
    return (
      <Riquadro icona={Share}>
        <div className="text-[12.5px] text-neutral-100">
          Aggiungi PEAK alla schermata Home
        </div>
        <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
          Su iPhone gli avvisi — una lezione annullata, un posto che si
          libera — arrivano solo se apri PEAK dall'icona e non dal
          browser. Tocca il bottone <strong className="text-neutral-300">Condividi</strong>{" "}
          qui sotto in Safari, poi{" "}
          <strong className="text-neutral-300">Aggiungi a Home</strong>. Da lì
          potrai accenderli.
        </p>
      </Riquadro>
    );
  }

  if (stato === "negate") {
    return (
      <Riquadro icona={BellOff}>
        <div className="text-[12.5px] text-neutral-100">Avvisi bloccati</div>
        <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
          Gli avvisi sono stati rifiutati su questo telefono. Da qui non
          si possono richiedere: si riaccendono dalle impostazioni del
          telefono, alla voce di questa app.
        </p>
      </Riquadro>
    );
  }

  const accese = stato === "accese";

  return (
    <Riquadro icona={accese ? Check : Bell} acceso={accese}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-neutral-100">
            {accese ? "Avvisi attivi su questo telefono" : "Avvisi sul telefono"}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
            {accese
              ? "Ti avvisiamo se una lezione che hai prenotato viene annullata o se si libera un posto per te. Nient'altro."
              : "Solo due cose: se una lezione che hai prenotato viene annullata, e se si libera un posto quando sei in lista d'attesa."}
          </p>
        </div>
        <button
          onClick={cambia}
          disabled={lavoro}
          className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold tracking-wider ${
            accese
              ? "border border-bordo text-neutral-400"
              : "bg-neutral-100 text-black"
          }`}
        >
          {lavoro ? "..." : accese ? "SPEGNI" : "ACCENDI"}
        </button>
      </div>

      {errore && (
        <p className="text-[11px] text-amber-300/90 mt-3 leading-relaxed">
          {errore}
        </p>
      )}
    </Riquadro>
  );
}

function Riquadro({ icona: Icona, acceso, children }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        acceso ? "border-bordo bg-scheda" : "border-neutral-700 bg-rilievo"
      }`}
    >
      <div className="flex gap-3">
        <Icona
          size={16}
          strokeWidth={1.8}
          className="text-neutral-400 shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
