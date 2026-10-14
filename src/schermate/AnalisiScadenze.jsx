import { useCallback, useEffect, useState } from "react";
import { scadenzeProssime } from "../lib/analisi";
import {
  Testata, Scelte, TitoloLista, RigaScadenza, fabbricaApriSocio,
} from "../ui/pezzi-analisi";
import { Vuoto, Scheletro, Avviso } from "../ui/base";

/* Scadenze — certificati, quote e abbonamenti in un elenco solo.

   Sono tre archivi diversi, ma per chi sta in segreteria sono una
   cosa sola: telefonate da fare in ordine di data.

   Ci sta dentro anche quello che è scaduto da poco, perché è lì che
   serve guardare: uno scaduto ieri è ancora recuperabile, e se la
   lista mostrasse solo il futuro sparirebbe proprio il giorno in cui
   diventa urgente. */

export default function AnalisiScadenze({ onIndietro, onApriSocio }) {
  const [righe, setRighe] = useState(null);
  const [giorni, setGiorni] = useState(30);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    setErrore("");
    try {
      setRighe(await scadenzeProssime(giorni));
    } catch {
      setErrore("Non riesco a leggere i dati.");
      setRighe([]);
    }
  }, [giorni]);

  useEffect(() => { carica(); }, [carica]);

  const apriSocio = fabbricaApriSocio(onApriSocio, righe);
  const gia = (righe ?? []).filter((r) => r.scaduta).length;

  return (
    <div className="px-5 pb-28 pt-1">
      <Testata
        titolo="Scadenze"
        spiega="Certificati medici, quote annuali e abbonamenti, in ordine
                di data. Chi ha già rinnovato non compare."
        onIndietro={onIndietro}
      />

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <TitoloLista
        scelte={
          <Scelte
            valore={giorni}
            opzioni={[
              { v: 15, nome: "15 gg" },
              { v: 30, nome: "30 gg" },
              { v: 90, nome: "90 gg" },
            ]}
            onCambia={setGiorni}
          />
        }
      >
        {gia > 0 ? `${gia} GIÀ SCADUTE` : "IN SCADENZA"}
      </TitoloLista>

      {righe === null ? (
        <Scheletro righe={3} />
      ) : righe.length === 0 ? (
        <Vuoto>Niente in scadenza nei prossimi {giorni} giorni.</Vuoto>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {righe.map((r, i) => (
              <RigaScadenza
                key={`${r.profilo_id}-${r.genere}-${r.quando}-${i}`}
                r={r}
                onApri={apriSocio}
              />
            ))}
          </div>
          <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
            Sono compresi, in evidenza, i rinnovi scaduti nelle ultime
            due settimane.
          </div>
        </>
      )}
    </div>
  );
}
