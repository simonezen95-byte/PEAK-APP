import { useCallback, useEffect, useState } from "react";
import { sociFermi, daQuanto } from "../lib/analisi";
import {
  Testata, Scelte, TitoloLista, RigaFermo, fabbricaApriSocio,
} from "../ui/pezzi-analisi";
import { Vuoto, Scheletro, Avviso } from "../ui/base";

/* Chi si è fermato — la lista che vale di più.

   Un socio che paga e non viene più è un socio che a scadenza non
   rinnova, e lo si scopre con tre mesi di ritardo se nessuno guarda.

   In cima chi paga e non viene: è lì che una telefonata recupera
   ancora qualcosa. In fondo noi dello staff, marcati: ci siamo perché
   i numeri devono dire la verità, ma nessuno telefona a sé stesso. */

export default function AnalisiFermi({ onIndietro, onApriSocio }) {
  const [righe, setRighe] = useState(null);
  const [settimane, setSettimane] = useState(3);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    setErrore("");
    try {
      setRighe(await sociFermi(settimane));
    } catch {
      setErrore("Non riesco a leggere i dati.");
      setRighe([]);
    }
  }, [settimane]);

  useEffect(() => { carica(); }, [carica]);

  const apriSocio = fabbricaApriSocio(onApriSocio, righe);
  const daChiamare = (righe ?? []).filter((r) => r.paga_e_non_viene).length;

  return (
    <div className="px-5 pb-28 pt-1">
      <Testata
        titolo="Chi si è fermato"
        spiega="Soci senza allenamenti recenti, in ordine di priorità."
        nota="Si misura sulle presenze confermate dal coach, non sulle
              prenotazioni. In testa chi ha un abbonamento attivo e
              pagato: è lì che un contatto recupera ancora qualcosa. Il
              personale interno è in fondo e contrassegnato."
        onIndietro={onIndietro}
      />

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <TitoloLista
        nota="Chi si è iscritto da meno del periodo scelto e non è ancora
              venuto non compare: non ha ancora avuto tempo."
        scelte={
          <Scelte
            valore={settimane}
            opzioni={[
              { v: 2, nome: "2 set" },
              { v: 3, nome: "3 set" },
              { v: 6, nome: "6 set" },
            ]}
            onCambia={setSettimane}
          />
        }
      >
        FERMI DA PIÙ DI {daQuanto(settimane * 7).toUpperCase()}
      </TitoloLista>

      {righe === null ? (
        <Scheletro righe={3} />
      ) : righe.length === 0 ? (
        <Vuoto>
          Nessuno fermo da più di {daQuanto(settimane * 7)}.
        </Vuoto>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {righe.map((r) => (
              <RigaFermo key={r.id} r={r} onApri={apriSocio} />
            ))}
          </div>
          {daChiamare > 0 && (
            <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
              {daChiamare === 1
                ? "Uno di questi ha l'abbonamento attivo e pagato"
                : `${daChiamare} di questi hanno l'abbonamento attivo e pagato`}
              : sono in cima all'elenco.
            </div>
          )}
        </>
      )}
    </div>
  );
}
