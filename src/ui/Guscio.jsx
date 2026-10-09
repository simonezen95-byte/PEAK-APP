import { useCallback, useEffect, useState } from "react";
import {
  Home as IconaHome, CalendarDays, Dumbbell, TrendingUp, Users, User,
  ChevronDown, Check, Bell,
} from "lucide-react";
import { useSessione } from "../lib/sessione";
import { eStaff } from "../lib/staff";
import { quanteDaLeggere } from "../lib/notifiche";
import { Logo, Messaggio } from "./base";
import Home from "../schermate/Home";
import Oggi from "../schermate/Oggi";
import Prenota from "../schermate/Prenota";
import Lezione from "../schermate/Lezione";
import Wod from "../schermate/Wod";
import Progressi from "../schermate/Progressi";
import Soci from "../schermate/Soci";
import Socio from "../schermate/Socio";
import Profilo from "../schermate/Profilo";
import Notifiche from "../schermate/Notifiche";

/* La struttura dell'app una volta dentro.

   Chi è staff ha due modi di usarla: da socio, e vede esattamente
   quello che vedono gli altri; da staff, e ha la console. Lo switch
   sta in alto a destra.

   Non è una questione di permessi — quelli stanno nel database e non
   cambiano a seconda di come guardi — è questione di cosa serve avere
   sottomano: in reception i progressi non interessano, mentre ci si
   allena l'elenco dei soci nemmeno.

   Risolve anche un problema pratico: cinque voci in basso sono il
   massimo che ci sta su un telefono, e così ogni modo ne ha meno. */

const RICORDA = "peak:modo";

export default function Guscio() {
  const { profilo } = useSessione();
  const staff = eStaff(profilo);

  const [modo, setModo] = useState(() => {
    try {
      return localStorage.getItem(RICORDA) === "socio" ? "socio" : "staff";
    } catch {
      return "staff";
    }
  });

  useEffect(() => {
    try { localStorage.setItem(RICORDA, modo); } catch { /* finestra privata */ }
  }, [modo]);

  const comeStaff = staff && modo === "staff";

  const sezioni = comeStaff
    ? [
        { chiave: "oggi",    nome: "Oggi",    icona: IconaHome },
        { chiave: "soci",    nome: "Soci",    icona: Users },
        { chiave: "wod",     nome: "WOD",     icona: Dumbbell },
        { chiave: "prenota", nome: "Classi",  icona: CalendarDays },
        { chiave: "profilo", nome: "Profilo", icona: User },
      ]
    : [
        { chiave: "home",      nome: "Home",      icona: IconaHome },
        { chiave: "prenota",   nome: "Prenota",   icona: CalendarDays },
        { chiave: "wod",       nome: "WOD",       icona: Dumbbell },
        { chiave: "progressi", nome: "Progressi", icona: TrendingUp },
        { chiave: "profilo",   nome: "Profilo",   icona: User },
      ];

  const [sezione, setSezione] = useState(() => (staff ? "oggi" : "home"));
  const [lezione, setLezione] = useState(null);
  const [socio, setSocio] = useState(null);
  const [progressi, setProgressi] = useState(false);
  const [notifiche, setNotifiche] = useState(false);
  const [daLeggere, setDaLeggere] = useState(0);
  const [messaggio, setMessaggio] = useState("");
  // Cambiando questo numero le schermate rileggono i dati: serve dopo
  // una prenotazione o una modifica, perché il quadro è cambiato.
  const [versione, setVersione] = useState(0);

  const contaNotifiche = useCallback(() => {
    quanteDaLeggere().then(setDaLeggere).catch(() => setDaLeggere(0));
  }, []);

  useEffect(() => { contaNotifiche(); }, [contaNotifiche]);

  function avvisa(testo) {
    setMessaggio(testo);
    setTimeout(() => setMessaggio(""), 3200);
  }

  function vaiA(chiave) {
    setLezione(null);
    setSocio(null);
    setProgressi(false);
    setNotifiche(false);
    setSezione(chiave);
  }

  function cambiaModo(nuovo) {
    setModo(nuovo);
    setLezione(null);
    setSocio(null);
    setProgressi(false);
    setNotifiche(false);
    setSezione(nuovo === "staff" ? "oggi" : "home");
  }

  const dettaglio = Boolean(lezione || socio || progressi || notifiche);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center px-5 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] border-b border-neutral-900 sticky top-0 bg-[#0D0D0D]/95 backdrop-blur z-20">
        <Logo altezza={26} />
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          {staff && <Interruttore modo={modo} onCambia={cambiaModo} profilo={profilo} />}
          <button
            onClick={() => { setNotifiche(true); setLezione(null); setSocio(null); setProgressi(false); }}
            aria-label={daLeggere > 0 ? `Notifiche, ${daLeggere} da leggere` : "Notifiche"}
            className="relative text-neutral-300 p-0.5"
          >
            <Bell size={20} strokeWidth={1.7} />
            {daLeggere > 0 && (
              <span className="absolute top-0 right-0 w-[7px] h-[7px] rounded-full bg-neutral-50 ring-2 ring-[#0D0D0D]" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto">
        {notifiche ? (
          <Notifiche onIndietro={() => setNotifiche(false)} onLette={contaNotifiche} />
        ) : lezione ? (
          <Lezione
            sessione={lezione}
            onIndietro={() => setLezione(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
          />
        ) : progressi ? (
          <Progressi onIndietro={() => setProgressi(false)} onMessaggio={avvisa} />
        ) : socio ? (
          <Socio
            socio={socio}
            onIndietro={() => setSocio(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
          />
        ) : sezione === "oggi" ? (
          <Oggi
            onVaiAiSoci={() => vaiA("soci")}
            onVaiAlleClassi={() => vaiA("prenota")}
            onVaiAlWod={() => vaiA("wod")}
            ricarica={versione}
          />
        ) : sezione === "home" ? (
          <Home
            onVaiAlCalendario={() => vaiA("prenota")}
            onVaiAlProfilo={() => vaiA("profilo")}
            onVaiAlWod={() => vaiA("wod")}
            onApriLezione={setLezione}
            ricarica={versione}
          />
        ) : sezione === "prenota" ? (
          <Prenota onApri={setLezione} ricarica={versione} />
        ) : sezione === "wod" ? (
          <Wod giornoIniziale={oggi()} onMessaggio={avvisa} />
        ) : sezione === "progressi" ? (
          <Progressi onMessaggio={avvisa} />
        ) : sezione === "soci" ? (
          <Soci onApri={setSocio} ricarica={versione} />
        ) : (
          // In modo staff i progressi non stanno in barra: si arriva
          // qui dal profilo.
          <Profilo onVaiAiProgressi={comeStaff ? () => setProgressi(true) : undefined} />
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
                className={`flex flex-col items-center gap-1 pt-3 pb-2.5 relative ${
                  attiva ? "text-neutral-50" : "text-neutral-600"
                }`}
              >
                <Icona size={19} strokeWidth={attiva ? 2.2 : 1.7} />
                <span className="text-[9px] tracking-[0.06em] font-semibold whitespace-nowrap">
                  {nome.toUpperCase()}
                </span>
                {attiva && (
                  <span className="absolute bottom-0 w-7 h-[2px] rounded-full bg-neutral-50" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** "Visualizza come": lo stesso menù del prototipo. */
function Interruttore({ modo, onCambia, profilo }) {
  const [aperto, setAperto] = useState(false);

  const voci = [
    { chiave: "staff", nome: nomeRuolo(profilo.ruolo), nota: "Console di gestione" },
    { chiave: "socio", nome: "Socio", nota: "L'app come la vedono gli altri" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setAperto((v) => !v)}
        className="flex items-center gap-1 text-neutral-400"
        aria-label="Cambia vista"
      >
        <span className="text-[11px] font-semibold">
          {modo === "staff" ? nomeRuolo(profilo.ruolo) : "Socio"}
        </span>
        <ChevronDown size={14} />
      </button>

      {aperto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAperto(false)} />
          <div className="absolute right-0 mt-2.5 w-56 bg-neutral-900 border border-neutral-800 rounded-2xl p-1.5 z-20 shadow-xl shadow-black/60">
            <div className="px-3 py-2 text-[9.5px] text-neutral-500 tracking-[0.15em] font-semibold">
              VISUALIZZA COME
            </div>
            {voci.map((v) => (
              <button
                key={v.chiave}
                onClick={() => { onCambia(v.chiave); setAperto(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl ${
                  modo === v.chiave ? "bg-neutral-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-neutral-100">{v.nome}</span>
                  {modo === v.chiave && (
                    <Check size={13} className="text-neutral-100" strokeWidth={3} />
                  )}
                </div>
                <div className="text-[10.5px] text-neutral-500 mt-0.5">{v.nota}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function nomeRuolo(ruolo) {
  return ruolo === "coach" ? "Coach" : ruolo === "owner" ? "Titolare" : "Admin";
}

/** Oggi in forma "2026-10-09". */
function oggi() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
