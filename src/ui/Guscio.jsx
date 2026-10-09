import { useState } from "react";
import { Home as IconaHome, CalendarDays, Users, User } from "lucide-react";
import { useSessione } from "../lib/sessione";
import { eStaff } from "../lib/staff";
import { Logo, Messaggio } from "./base";
import Home from "../schermate/Home";
import Prenota from "../schermate/Prenota";
import Lezione from "../schermate/Lezione";
import Soci from "../schermate/Soci";
import Socio from "../schermate/Socio";
import Profilo from "../schermate/Profilo";

/* La struttura dell'app una volta dentro: una barra sopra, le sezioni
   sotto, e le schermate di dettaglio che si aprono a tutto schermo.

   La sezione Soci compare solo a chi è staff. Non è una misura di
   sicurezza — quella sta nel database, che a un socio non darebbe
   comunque niente — è solo per non mostrare porte chiuse. */

export default function Guscio() {
  const { profilo } = useSessione();
  const staff = eStaff(profilo);

  const sezioni = [
    { chiave: "home",    nome: "Home",    icona: IconaHome },
    { chiave: "prenota", nome: "Prenota", icona: CalendarDays },
    ...(staff ? [{ chiave: "soci", nome: "Soci", icona: Users }] : []),
    { chiave: "profilo", nome: "Profilo", icona: User },
  ];

  const [sezione, setSezione] = useState("home");
  const [lezione, setLezione] = useState(null);
  const [socio, setSocio] = useState(null);
  const [messaggio, setMessaggio] = useState("");
  // Cambiando questo numero le schermate rileggono i dati: serve dopo
  // una prenotazione o una modifica, perché il quadro è cambiato.
  const [versione, setVersione] = useState(0);

  function avvisa(testo) {
    setMessaggio(testo);
    setTimeout(() => setMessaggio(""), 3200);
  }

  function vaiA(chiave) {
    setLezione(null);
    setSocio(null);
    setSezione(chiave);
  }

  const dettaglio = Boolean(lezione || socio);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-center py-3.5 border-b border-neutral-900 sticky top-0 bg-[#0D0D0D]/95 backdrop-blur z-20">
        <Logo altezza={22} />
      </header>

      <main className="flex-1 max-w-md w-full mx-auto">
        {lezione ? (
          <Lezione
            sessione={lezione}
            onIndietro={() => setLezione(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
          />
        ) : socio ? (
          <Socio
            socio={socio}
            onIndietro={() => setSocio(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
          />
        ) : sezione === "home" ? (
          <Home onVaiAlCalendario={() => vaiA("prenota")} ricarica={versione} />
        ) : sezione === "prenota" ? (
          <Prenota onApri={setLezione} ricarica={versione} />
        ) : sezione === "soci" ? (
          <Soci onApri={setSocio} ricarica={versione} />
        ) : (
          <Profilo />
        )}
      </main>

      <Messaggio testo={messaggio} />

      <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-900 bg-[#0D0D0D]/95 backdrop-blur z-20 pb-[env(safe-area-inset-bottom)]">
        <div
          className="max-w-md mx-auto grid"
          style={{ gridTemplateColumns: `repeat(${sezioni.length}, minmax(0, 1fr))` }}
        >
          {sezioni.map(({ chiave, nome, icona: Icona }) => {
            const attiva = sezione === chiave && !dettaglio;
            return (
              <button
                key={chiave}
                onClick={() => vaiA(chiave)}
                className={`flex flex-col items-center gap-1 py-3 ${
                  attiva ? "text-neutral-50" : "text-neutral-600"
                }`}
              >
                <Icona size={19} strokeWidth={attiva ? 2.2 : 1.7} />
                <span className="text-[9.5px] tracking-wider font-semibold">
                  {nome.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
