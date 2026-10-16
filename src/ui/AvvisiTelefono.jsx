import { useCallback, useEffect, useState } from "react";
import { comeSiamo, accendi, spegni } from "../lib/push";
import { Card, Titolo, Interruttore, RigaImpostazione } from "./base";

/* Gli avvisi sul telefono, come riga di impostazione.

   Un interruttore e non un bottone: lo stato si legge a colpo
   d'occhio senza doverlo scrivere.

   Il permesso del telefono si può chiedere una volta sola. Se il
   socio dice di no, l'app non può più richiederlo: solo lui può
   tornare indietro dalle impostazioni del telefono. Per questo i casi
   in cui l'interruttore non funzionerebbe sono distinti, e ognuno
   dice cosa fare — "il tuo telefono non può" e "hai detto di no"
   sembrano la stessa cosa e si rimediano in modi opposti.

   Per ora questa è l'unica impostazione, quindi la sezione se la
   porta dietro da sé. Quando ce ne sarà più d'una, il titolo torna
   alla schermata Profilo e qui resta solo la riga. */

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
          ? "Gli avvisi sono stati rifiutati su questo telefono. Si riattivano dalle impostazioni del telefono, alla voce PEAK."
          : m === "da-casa"
          ? "Su iPhone va prima aggiunta l'app alla schermata Home."
          : "Non è stato possibile attivare gli avvisi su questo telefono."
      );
      await guarda();
    }
    setLavoro(false);
  }

  // Finché non si sa, e quando il telefono proprio non può, non si
  // mostra niente: un interruttore che non funziona è peggio di
  // nessun interruttore.
  if (stato === null || stato === "impossibile") return null;

  const accese = stato === "accese";
  const bloccato = stato === "negate" || stato === "da-casa" || lavoro;

  const nota =
    stato === "da-casa"
      ? "Su iPhone gli avvisi arrivano solo aprendo PEAK dall'icona nella schermata Home. In Safari: Condividi, poi Aggiungi a Home."
      : stato === "negate"
      ? "Rifiutati su questo telefono. Si riattivano dalle impostazioni del telefono, alla voce PEAK."
      : "Lezioni annullate e posti che si liberano dalla lista d'attesa.";

  return (
    <>
      <Titolo>IMPOSTAZIONI</Titolo>
      <Card className="divide-y divide-filo mb-8">
        <RigaImpostazione nome="Avvisi su questo telefono" nota={nota}>
          <Interruttore
            acceso={accese}
            onCambia={cambia}
            bloccato={bloccato}
            etichetta="Avvisi su questo telefono"
          />
        </RigaImpostazione>

        {errore && (
          <p className="text-[11px] text-amber-300/90 pt-3 leading-relaxed">
            {errore}
          </p>
        )}
      </Card>
    </>
  );
}
