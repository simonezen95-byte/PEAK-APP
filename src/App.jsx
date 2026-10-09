import { useState } from "react";
import { configurato } from "./lib/supabase";
import { useSessione } from "./lib/sessione";
import { Logo } from "./ui/base";
import Accesso from "./schermate/Accesso";
import Registrazione from "./schermate/Registrazione";
import Attesa from "./schermate/Attesa";
import Dentro from "./schermate/Dentro";

/* Decide quale schermata mostrare. L'ordine delle domande è:
   l'app è collegata? → c'è un account? → ha una scheda socio?
   → la scheda è approvata? */

export default function App() {
  const { caricamento, utente, profilo } = useSessione();
  const [registrazione, setRegistrazione] = useState(false);

  if (!configurato) return <Configurazione />;
  if (caricamento) return <Attendere />;

  if (!utente) {
    return registrazione ? (
      <Registrazione onIndietro={() => setRegistrazione(false)} />
    ) : (
      <Accesso onRegistrati={() => setRegistrazione(true)} />
    );
  }

  // Account creato ma scheda non ancora salvata: può succedere se la
  // registrazione si è interrotta a metà.
  if (!profilo) return <Attesa />;

  if (profilo.stato === "sospeso") return <Attesa sospeso />;
  if (profilo.stato !== "approvato") return <Attesa />;

  return <Dentro />;
}

function Attendere() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <div className="opacity-40">
        <Logo altezza={40} />
      </div>
    </div>
  );
}

/** Compare se mancano le chiavi di collegamento al database.
    Serve a capire subito il problema invece di vedere una pagina bianca. */
function Configurazione() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-8 text-center max-w-sm mx-auto">
      <Logo altezza={40} />
      <p className="text-[13px] text-neutral-400 mt-8 leading-relaxed">
        L'app non è collegata al database.
      </p>
      <p className="text-[12px] text-neutral-600 mt-3 leading-relaxed">
        Mancano <code className="text-neutral-400">VITE_SUPABASE_URL</code> e{" "}
        <code className="text-neutral-400">VITE_SUPABASE_ANON_KEY</code> fra le
        variabili d'ambiente.
      </p>
    </div>
  );
}
