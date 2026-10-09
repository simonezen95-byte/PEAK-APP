import { useEffect, useState } from "react";
import { LogOut, Check, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useSessione } from "../lib/sessione";
import { Logo } from "../ui/base";

/* Prima schermata di chi è dentro. Per ora mostra solo la propria
   situazione: serve a verificare che l'app legga davvero dal
   database. Le schermate vere (home, classi, WOD, progressi)
   arrivano una alla volta. */

export default function Dentro() {
  const { profilo, esci } = useSessione();
  const [abbonamento, setAbbonamento] = useState(null);
  const [classi, setClassi] = useState(0);
  const [carica, setCarica] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [abb, pal] = await Promise.all([
        supabase
          .from("abbonamenti")
          .select("fine, pacchetti(nome)")
          .eq("profilo_id", profilo.id)
          .order("fine", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("palinsesto")
          .select("id", { count: "exact", head: true })
          .eq("tipo", "classe"),
      ]);
      if (!vivo) return;
      setAbbonamento(abb.data ?? null);
      setClassi(pal.count ?? 0);
      setCarica(false);
    })();
    return () => { vivo = false; };
  }, [profilo.id]);

  const certificatoOk =
    profilo.certificato_scadenza &&
    new Date(profilo.certificato_scadenza) >= new Date();

  return (
    <div className="min-h-full px-6 py-8 max-w-sm mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <Logo altezza={34} />
        <button
          onClick={esci}
          aria-label="Esci"
          className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-200"
        >
          <LogOut size={18} />
        </button>
      </div>

      <h1 className="font-display font-bold text-[26px] text-neutral-50 leading-tight">
        Ciao {profilo.nome}
      </h1>
      <p className="text-[13px] text-neutral-500 mt-1.5">
        Tessera #{String(profilo.numero_tessera).padStart(5, "0")}
      </p>

      <div className="mt-7 space-y-2.5">
        <Riga
          etichetta="Abbonamento"
          valore={
            carica ? "…"
            : abbonamento ? abbonamento.pacchetti?.nome ?? "Registrato"
            : "Da registrare in reception"
          }
          ok={Boolean(abbonamento)}
        />
        <Riga
          etichetta="Certificato medico"
          valore={
            profilo.certificato_scadenza
              ? new Date(profilo.certificato_scadenza).toLocaleDateString("it-IT")
              : "Da consegnare in reception"
          }
          ok={certificatoOk}
        />
      </div>

      <div className="mt-8 border border-neutral-800 rounded-xl px-4 py-4">
        <p className="text-[12.5px] text-neutral-400 leading-relaxed">
          Sei collegato al database: l'app legge la tua scheda e il palinsesto
          del box{classi > 0 ? `, ${classi} classi a settimana` : ""}.
          <br />
          <span className="text-neutral-600">
            Le schermate vere — home, classi, WOD, progressi — arrivano una
            alla volta.
          </span>
        </p>
      </div>
    </div>
  );
}

function Riga({ etichetta, valore, ok }) {
  return (
    <div className="flex items-center gap-3 bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3.5">
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] text-neutral-500">{etichetta}</span>
        <span className="block text-[14px] text-neutral-100 truncate">{valore}</span>
      </span>
      {ok ? (
        <Check size={17} className="text-emerald-400 shrink-0" />
      ) : (
        <AlertTriangle size={17} className="text-amber-400 shrink-0" />
      )}
    </div>
  );
}
