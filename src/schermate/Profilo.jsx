import { LogOut, Mail, Phone, Hash, TrendingUp, ChevronRight } from "lucide-react";
import { useSessione } from "../lib/sessione";
import { Card, Titolo } from "../ui/base";

/* Per ora solo la tua scheda e l'uscita. Le impostazioni vere
   (notifiche, privacy, foto) arrivano con le prossime sezioni. */

export default function Profilo({ onVaiAiProgressi }) {
  const { profilo, esci } = useSessione();

  return (
    <div className="px-5 pb-28 pt-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full border border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden">
          {profilo.foto_url ? (
            <img src={profilo.foto_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[18px] font-display font-bold text-neutral-400">
              {(profilo.nome?.[0] ?? "") + (profilo.cognome?.[0] ?? "")}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[20px] font-display font-bold text-neutral-50 leading-tight truncate">
            {profilo.nome} {profilo.cognome}
          </div>
          <div className="text-[11.5px] text-neutral-500 mt-0.5 first-letter:uppercase">
            {profilo.ruolo === "socio" ? "socio" : profilo.ruolo}
          </div>
        </div>
      </div>

      {onVaiAiProgressi && (
        <button
          onClick={onVaiAiProgressi}
          className="w-full rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3.5 mb-7"
        >
          <TrendingUp size={16} className="text-neutral-400 shrink-0" strokeWidth={1.8} />
          <div className="flex-1 text-left">
            <div className="text-[13px] text-neutral-100">Progressi</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Massimali, risultati dei WOD, allenamenti
            </div>
          </div>
          <ChevronRight size={16} className="text-neutral-700 shrink-0" />
        </button>
      )}

      <Titolo>I TUOI DATI</Titolo>
      <Card className="divide-y divide-filo mb-8">
        <Riga icona={Hash} nome="Tessera" valore={profilo.numero_tessera ?? "–"} />
        <Riga icona={Mail} nome="Email" valore={profilo.email} />
        <Riga icona={Phone} nome="Telefono" valore={profilo.telefono} />
      </Card>

      <p className="text-[11px] text-neutral-600 leading-relaxed mb-6">
        Nome, cognome e data di nascita li modifica lo staff in reception.
        Per cambiare email o telefono scrivici.
      </p>

      <button
        onClick={esci}
        className="w-full rounded-xl border border-bordo text-neutral-400 py-3.5 text-[12.5px] font-semibold flex items-center justify-center gap-2"
      >
        <LogOut size={15} />
        ESCI
      </button>
    </div>
  );
}

function Riga({ icona: Icona, nome, valore }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Icona size={15} className="text-neutral-600 shrink-0" />
      <div className="text-[12.5px] text-neutral-500 flex-1">{nome}</div>
      <div className="text-[12.5px] text-neutral-200 truncate max-w-[55%] text-right">
        {valore}
      </div>
    </div>
  );
}
