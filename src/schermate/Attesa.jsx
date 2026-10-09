import { useState } from "react";
import { Clock, Ban, RefreshCw, LogOut } from "lucide-react";
import { useSessione } from "../lib/sessione";
import { Logo, Bottone } from "../ui/base";

/* Due situazioni in cui l'account esiste ma non si entra:
   l'iscrizione non è ancora stata approvata, oppure lo staff ha
   sospeso l'accesso. */

export default function Attesa({ sospeso = false }) {
  const { profilo, ricaricaProfilo, esci } = useSessione();
  const [controllo, setControllo] = useState(false);

  async function ricontrolla() {
    setControllo(true);
    await ricaricaProfilo();
    setControllo(false);
  }

  const Icona = sospeso ? Ban : Clock;

  return (
    <div className="min-h-full flex flex-col px-6 py-10 max-w-sm mx-auto w-full">
      <div className="flex justify-center">
        <Logo altezza={44} />
      </div>

      <div className="flex-1 flex flex-col justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-scheda border border-bordo flex items-center justify-center mx-auto mb-6">
          <Icona size={26} strokeWidth={1.5} className="text-neutral-400" />
        </div>

        <h1 className="font-display font-bold text-[22px] text-neutral-50">
          {sospeso ? "Accesso sospeso" : "Iscrizione in attesa"}
        </h1>

        <p className="text-[13px] text-neutral-400 mt-3 leading-relaxed">
          {sospeso ? (
            <>
              Il tuo accesso all'app è stato sospeso dallo staff. Storico,
              presenze e massimali restano salvati. Passa in reception o
              scrivici e lo risolviamo.
            </>
          ) : (
            <>
              Ciao {profilo?.nome}, abbiamo ricevuto la tua richiesta.
              <br />
              Lo staff la approva in reception, quando porti il certificato
              medico. Poi entri.
            </>
          )}
        </p>

        {!sospeso && (
          <div className="mt-8">
            <Bottone variante="vuoto" onClick={ricontrolla} carica={controllo}>
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={14} />
                CONTROLLA DI NUOVO
              </span>
            </Bottone>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-filo">
          <p className="text-[12px] text-neutral-500 leading-relaxed">
            Serve aiuto? Scrivi o chiama lo
            <br />
            <a href="https://wa.me/393937652236" className="text-neutral-300 underline underline-offset-2">
              393 765 2236
            </a>
          </p>
        </div>
      </div>

      <button
        onClick={esci}
        className="flex items-center justify-center gap-2 text-[12.5px] text-neutral-500 hover:text-neutral-300 py-3"
      >
        <LogOut size={15} />
        Esci
      </button>
    </div>
  );
}
