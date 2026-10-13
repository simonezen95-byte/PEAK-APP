import {
  ShieldCheck, Tag, Megaphone, Settings, TrendingUp, User, ChevronRight,
} from "lucide-react";
import { useSessione } from "../lib/sessione";
import { eOwner } from "../lib/ruoli";
import { puoGestireListino } from "../lib/pacchetti";
import { Titolo } from "../ui/base";

/* La quinta voce della barra, lato staff.

   Prima lì c'era "Profilo", che però era la stessa schermata che vede
   il socio: una copia inutile al quinto posto della barra. Al suo
   posto ci stanno le cose di gestione che si usano di rado — come da
   decisioni, in basso vanno le cose di tutti i giorni e il resto si
   raccoglie qui.

   Le voci non ancora costruite si vedono lo stesso, spente e con
   scritto cosa manca: così si sa cosa c'è e cosa no, invece di
   cercarlo. */

export default function Altro({ onApri, onVaiAlProfilo }) {
  const { profilo } = useSessione();

  const gestione = [
    eOwner(profilo) && {
      chiave: "staff",
      icona: ShieldCheck,
      nome: "Staff e permessi",
      nota: "Chi gestisce il box e cosa può fare",
    },
    puoGestireListino(profilo) && {
      chiave: "listino",
      icona: Tag,
      nome: "Listino",
      nota: "Prezzi e pacchetti che la reception può vendere",
    },
    {
      chiave: "comunicazioni",
      icona: Megaphone,
      nome: "Comunicazioni",
      nota: "Avvisi ai soci e bacheca",
      manca: "da costruire",
    },
    eOwner(profilo) && {
      chiave: "impostazioni",
      icona: Settings,
      nome: "Impostazioni del box",
      nota: "Palinsesto, orari, dati dell'associazione",
      manca: "da costruire",
    },
  ].filter(Boolean);

  return (
    <div className="px-5 pb-28 pt-6">
      <div className="text-[21px] font-display font-bold text-neutral-50 uppercase leading-tight mb-6">
        Altro
      </div>

      <Titolo>GESTIONE</Titolo>
      <div className="flex flex-col gap-2 mb-7">
        {gestione.map((v) => (
          <Voce key={v.chiave} {...v} onClick={() => onApri(v.chiave)} />
        ))}
      </div>

      <Titolo>IL TUO</Titolo>
      <div className="flex flex-col gap-2">
        <Voce
          icona={TrendingUp}
          nome="Progressi"
          nota="Massimali, risultati dei WOD, allenamenti"
          onClick={() => onApri("progressi")}
        />
        <Voce
          icona={User}
          nome="Profilo"
          nota="I tuoi dati, e l'uscita"
          onClick={onVaiAlProfilo}
        />
      </div>
    </div>
  );
}

function Voce({ icona: Icona, nome, nota, manca, onClick }) {
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
        <ChevronRight size={16} className="text-neutral-700 shrink-0" />
      )}
    </button>
  );
}
