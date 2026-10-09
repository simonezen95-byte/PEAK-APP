import { useState } from "react";
import { Home as IconaHome, CalendarDays, User } from "lucide-react";
import { Logo, Messaggio } from "./base";
import Home from "../schermate/Home";
import Prenota from "../schermate/Prenota";
import Lezione from "../schermate/Lezione";
import Profilo from "../schermate/Profilo";

/* La struttura dell'app una volta dentro: una barra sopra, le tre
   sezioni sotto, e una lezione che si apre a tutto schermo. */

const SEZIONI = [
  { chiave: "home",    nome: "Home",     icona: IconaHome },
  { chiave: "prenota", nome: "Prenota",  icona: CalendarDays },
  { chiave: "profilo", nome: "Profilo",  icona: User },
];

export default function Guscio() {
  const [sezione, setSezione] = useState("home");
  const [lezione, setLezione] = useState(null);
  const [messaggio, setMessaggio] = useState("");
  // Cambiando questo numero le schermate rileggono i dati: serve dopo
  // una prenotazione, perché i posti liberi sono cambiati per tutti.
  const [versione, setVersione] = useState(0);

  function avvisa(testo) {
    setMessaggio(testo);
    setTimeout(() => setMessaggio(""), 3200);
  }

  function vaiA(chiave) {
    setLezione(null);
    setSezione(chiave);
  }

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
        ) : sezione === "home" ? (
          <Home onVaiAlCalendario={() => vaiA("prenota")} ricarica={versione} />
        ) : sezione === "prenota" ? (
          <Prenota onApri={setLezione} ricarica={versione} />
        ) : (
          <Profilo />
        )}
      </main>

      <Messaggio testo={messaggio} />

      <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-900 bg-[#0D0D0D]/95 backdrop-blur z-20 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {SEZIONI.map(({ chiave, nome, icona: Icona }) => {
            const attiva = sezione === chiave && !lezione;
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
