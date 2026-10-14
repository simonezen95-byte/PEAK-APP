import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, Users, UserMinus, CalendarClock, Clock,
  LayoutGrid, Wallet, UserRound, TrendingUp, Dumbbell,
} from "lucide-react";
import { analisiSoci } from "../lib/analisi";
import { Titolo } from "../ui/base";
import AnalisiSoci from "./AnalisiSoci";
import AnalisiFermi from "./AnalisiFermi";
import AnalisiScadenze from "./AnalisiScadenze";
import AnalisiEconomia from "./AnalisiEconomia";

/* Analisi — l'indice.

   Non è una schermata con dentro tutto: è un elenco da cui si entra
   in un'analisi alla volta. Serve perché le analisi non sono tre,
   saranno dieci, e una schermata sola che le contenesse tutte
   diventerebbe un rotolo in cui non si trova niente.

   Le voci ancora da costruire si vedono lo stesso, spente, come in
   Altro: così si sa cosa c'è e cosa no invece di cercarlo, e si vede
   dove stiamo andando.

   Accanto alle voci già pronte c'è il numero. Un indice che mostra
   solo nomi costringe ad aprire tutto per sapere se c'è qualcosa da
   fare; con i numeri in faccia, a volte basta guardarlo. */

const GRUPPI = [
  {
    titolo: "SOCI",
    voci: [
      {
        chiave: "soci", icona: Users, nome: "Stato dei soci",
        nota: "Attivi, fermi, appena arrivati",
      },
      {
        chiave: "fermi", icona: UserMinus, nome: "Chi si è fermato",
        nota: "Da richiamare, in ordine di urgenza",
        conta: (n) => n?.fermi,
      },
      {
        chiave: "scadenze", icona: CalendarClock, nome: "Scadenze",
        nota: "Certificati, quote e abbonamenti",
        conta: (n) => n?.scadenze,
      },
    ],
  },
  {
    titolo: "CLASSI",
    voci: [
      {
        chiave: "orari", icona: Clock, nome: "Presenze e orari",
        nota: "Quali fasce orarie si riempiono",
        manca: "da costruire",
      },
      {
        chiave: "riempimento", icona: LayoutGrid, nome: "Riempimento",
        nota: "Posti usati, disdette, assenze",
        manca: "da costruire",
      },
      {
        chiave: "coach", icona: Dumbbell, nome: "Coach",
        nota: "Classi tenute, e quanta gente ci va",
        manca: "da costruire",
      },
    ],
  },
  {
    titolo: "ANDAMENTO",
    voci: [
      {
        chiave: "economia", icona: Wallet, nome: "Economia",
        nota: "Cosa portano abbonamenti e quote",
      },
      {
        chiave: "prove", icona: UserRound, nome: "Prove",
        nota: "Quante vengono a provare, per mese",
        manca: "da costruire",
      },
      {
        chiave: "crescita", icona: TrendingUp, nome: "Crescita",
        nota: "Iscritti e abbandoni mese per mese",
        manca: "da costruire",
      },
    ],
  },
];

export default function Analisi({ onIndietro, onApriSocio }) {
  const [dove, setDove] = useState(null);
  const [numeri, setNumeri] = useState(null);

  // I numeri accanto alle voci. Se non arrivano non succede niente:
  // l'indice funziona lo stesso, mostra solo i nomi.
  useEffect(() => {
    analisiSoci(3, 30).then(setNumeri).catch(() => setNumeri(null));
  }, [dove]);

  if (dove === "soci") {
    return (
      <AnalisiSoci
        onIndietro={() => setDove(null)}
        onApriFermi={() => setDove("fermi")}
        onApriScadenze={() => setDove("scadenze")}
      />
    );
  }
  if (dove === "fermi") {
    return <AnalisiFermi onIndietro={() => setDove(null)} onApriSocio={onApriSocio} />;
  }
  if (dove === "scadenze") {
    return <AnalisiScadenze onIndietro={() => setDove(null)} onApriSocio={onApriSocio} />;
  }
  if (dove === "economia") {
    return <AnalisiEconomia onIndietro={() => setDove(null)} />;
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="mt-2 mb-6">
        <div className="text-[21px] font-display font-bold text-neutral-50 uppercase leading-tight">
          Analisi
        </div>
        <div className="text-[11.5px] text-neutral-500 mt-1 leading-relaxed">
          I numeri della palestra. Si aggiornano da soli: tutto quello
          che qui dentro si chiama presenza è una presenza confermata dal
          coach a fine lezione.
        </div>
      </div>

      {GRUPPI.map((g) => (
        <div key={g.titolo} className="mb-7">
          <Titolo>{g.titolo}</Titolo>
          <div className="flex flex-col gap-2">
            {g.voci.map((v) => (
              <Voce
                key={v.chiave}
                {...v}
                valore={v.conta ? v.conta(numeri) : null}
                onClick={() => setDove(v.chiave)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="text-[10.5px] text-neutral-600 leading-relaxed">
        Le voci spente sono le prossime da costruire. Se te ne serve una
        che qui non c'è, o se l'ordine non è quello giusto per come
        lavori, dimmelo.
      </div>
    </div>
  );
}

function Voce({ icona: Icona, nome, nota, manca, valore, onClick }) {
  const spento = Boolean(manca);
  return (
    <button
      onClick={spento ? undefined : onClick}
      disabled={spento}
      className={`w-full rounded-2xl border p-3.5 flex items-center gap-3.5 text-left ${
        spento ? "border-filo" : "border-bordo bg-scheda"
      }`}
    >
      <Icona
        size={16}
        className={spento ? "text-neutral-700 shrink-0" : "text-neutral-400 shrink-0"}
        strokeWidth={1.8}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] ${spento ? "text-neutral-600" : "text-neutral-100"}`}>
          {nome}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{nota}</div>
      </div>

      {spento ? (
        <span className="text-[9.5px] tracking-[0.1em] text-neutral-700 font-semibold shrink-0">
          {manca.toUpperCase()}
        </span>
      ) : (
        <>
          {valore != null && (
            <span className="text-[15px] font-display font-bold text-neutral-50 tabular-nums shrink-0">
              {valore}
            </span>
          )}
          <ChevronRight size={16} className="text-neutral-700 shrink-0" />
        </>
      )}
    </button>
  );
}
