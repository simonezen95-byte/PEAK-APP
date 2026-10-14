import { useCallback, useEffect, useState } from "react";
import {
  Users, Activity, UserMinus, Sparkles, CalendarClock, UserRound,
} from "lucide-react";
import { analisiSoci } from "../lib/analisi";
import { Testata, Scelte } from "../ui/pezzi-analisi";
import { Card, Scheletro, Avviso } from "../ui/base";

/* Stato dei soci — la fotografia di chi c'è.

   Ogni numero è qui perché fa fare qualcosa. "Quanti soci in totale"
   non fa fare niente: al suo posto ci sono i tre gruppi in cui si
   dividono i soci, che sommati fanno il totale.

   I tre si escludono a vicenda di proposito. Se "attivi negli ultimi
   30 giorni" e "fermi da 3 settimane" usassero due misure diverse,
   con dieci soci si leggerebbe "6 attivi e 5 fermi" e la schermata
   perderebbe credibilità in un secondo. */

export default function AnalisiSoci({ onIndietro, onApriFermi, onApriScadenze }) {
  const [n, setN] = useState(null);
  const [settimane, setSettimane] = useState(3);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    setErrore("");
    try {
      setN(await analisiSoci(settimane, 30));
    } catch {
      setErrore("Non riesco a leggere i dati.");
      setN(null);
    }
  }, [settimane]);

  useEffect(() => { carica(); }, [carica]);

  const soci = Number(n?.soci) || 0;
  const q = (x) => (soci > 0 ? Math.round((Number(x) || 0) * 100 / soci) : 0);

  return (
    <div className="px-5 pb-28 pt-1">
      <Testata
        titolo="Stato dei soci"
        spiega="Quanti si allenano davvero. Conta solo la presenza
                confermata dal coach."
        nota="Chi prenota e non si presenta non risulta allenato: la
              prenotazione da sola non conta. I tre gruppi non si
              sovrappongono — ogni socio sta in uno solo — e nel conto è
              compreso lo staff."
        onIndietro={onIndietro}
      />

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {!n && !errore ? (
        <Scheletro righe={3} />
      ) : n ? (
        <>
          <div className="flex justify-end mb-3">
            <Scelte
              valore={settimane}
              opzioni={[
                { v: 2, nome: "2 set" },
                { v: 3, nome: "3 set" },
                { v: 6, nome: "6 set" },
              ]}
              onCambia={setSettimane}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Grosso icona={Activity} valore={n.attivi} nome="ATTIVI"
                    nota={`${q(n.attivi)}%`} />
            {/* Il riquadro dei fermi si tocca: il numero da solo non
                serve a niente, servono i nomi da chiamare. */}
            <Grosso icona={UserMinus} valore={n.fermi} nome="FERMI"
                    nota={`${q(n.fermi)}%`} allarme={Number(n.fermi) > 0}
                    onClick={onApriFermi} />
            <Grosso icona={Sparkles} valore={n.appena_arrivati} nome="NUOVI"
                    nota={`${q(n.appena_arrivati)}%`} />
          </div>

          <div className="text-[10.5px] text-neutral-600 mt-2.5 leading-relaxed">
            Attivo chi si è allenato nelle ultime {settimane}{" "}
            {settimane === 1 ? "settimana" : "settimane"}; nuovo chi si è
            iscritto da meno e non è ancora venuto.
          </div>

          <Card className="mt-4 !p-0 flex items-stretch divide-x divide-rilievo">
            <Piccolo icona={Users} valore={n.soci} nome="SOCI" />
            <Piccolo icona={CalendarClock} valore={n.scadenze}
                     nome="SCADENZE 30 GG" onClick={onApriScadenze} />
            <Piccolo icona={UserRound} valore={n.prove_del_mese}
                     nome="PROVE DEL MESE" />
          </Card>

          <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
            Tocca un riquadro per aprire l'elenco.
          </div>
        </>
      ) : null}
    </div>
  );
}

function Grosso({ icona: Icona, valore, nome, nota, allarme, onClick }) {
  const dentro = (
    <>
      <Icona size={15} className="text-neutral-400 mb-2" strokeWidth={1.8} />
      <div className="text-[24px] font-display font-bold text-neutral-50 leading-none">
        {valore ?? 0}
      </div>
      <div className="text-[8.5px] tracking-[0.1em] text-neutral-500 mt-2 font-semibold leading-tight">
        {nome}
      </div>
      {nota && <div className="text-[9px] text-neutral-600 mt-1">{nota}</div>}
    </>
  );
  const vestito = `rounded-2xl border p-3 flex flex-col items-center text-center ${
    allarme ? "border-neutral-600 bg-rilievo" : "border-bordo bg-scheda"
  }`;

  if (!onClick) return <div className={vestito}>{dentro}</div>;
  return <button onClick={onClick} className={vestito}>{dentro}</button>;
}

function Piccolo({ icona: Icona, valore, nome, onClick }) {
  const dentro = (
    <>
      <Icona size={14} className="text-neutral-500 mb-1.5" strokeWidth={1.8} />
      <div className="text-[17px] font-display font-bold text-neutral-100 leading-none">
        {valore ?? 0}
      </div>
      <div className="text-[8px] tracking-[0.1em] text-neutral-600 mt-1.5 font-semibold leading-tight">
        {nome}
      </div>
    </>
  );
  const vestito = "flex-1 flex flex-col items-center text-center py-3.5 px-1";

  if (!onClick) return <div className={vestito}>{dentro}</div>;
  return <button onClick={onClick} className={vestito}>{dentro}</button>;
}
