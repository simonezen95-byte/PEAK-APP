import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Bell, Check, Clock, CreditCard, Megaphone } from "lucide-react";
import { mieNotifiche, segnaLette, quantoFa } from "../lib/notifiche";
import { Card, Scheletro, Vuoto, Cerchio } from "../ui/base";

/* Le notifiche: per ora le scrive il database quando entri in classe
   dalla lista d'attesa. Si segnano come lette appena le apri. */

const ICONE = {
  prenotazioni: Check,
  lista_attesa: Clock,
  abbonamento: CreditCard,
  comunicazioni: Megaphone,
};

export default function Notifiche({ onIndietro, onLette }) {
  const [righe, setRighe] = useState(null);

  const carica = useCallback(async () => {
    try {
      const n = await mieNotifiche();
      setRighe(n);
      const daLeggere = n.filter((r) => !r.letta_il).map((r) => r.id);
      if (daLeggere.length) {
        await segnaLette(daLeggere);
        onLette?.();
      }
    } catch {
      setRighe([]);
    }
  }, [onLette]);

  useEffect(() => { carica(); }, [carica]);

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <h1 className="text-[21px] font-display font-bold text-neutral-50 mt-2 mb-6">
        Notifiche
      </h1>

      {righe === null ? (
        <Scheletro righe={3} />
      ) : righe.length === 0 ? (
        <Vuoto>
          Nessuna notifica.
          <br />
          Qui arrivano gli avvisi: quando entri in classe dalla lista
          d'attesa, per esempio.
        </Vuoto>
      ) : (
        <div className="flex flex-col gap-2.5">
          {righe.map((r) => {
            const Icona = ICONE[r.gruppo] ?? Bell;
            return (
              <Card
                key={r.id}
                className={`flex items-start gap-3.5 ${
                  r.letta_il ? "" : "border-neutral-600"
                }`}
              >
                <Cerchio icona={Icona} misura={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-neutral-100">{r.titolo}</div>
                  {r.testo && (
                    <div className="text-[11.5px] text-neutral-400 mt-1 leading-relaxed">
                      {r.testo}
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-600 mt-1.5">
                    {quantoFa(r.creata_il)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
