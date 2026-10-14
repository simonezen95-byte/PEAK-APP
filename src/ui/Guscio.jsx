import { useCallback, useEffect, useState } from "react";
import {
  Home as IconaHome, CalendarDays, Dumbbell, Users, User,
  ChevronDown, Check, Bell, BarChart3, LayoutGrid,
} from "lucide-react";
import { useSessione } from "../lib/sessione";
import { eStaff } from "../lib/staff";
import { haGestione } from "../lib/ruoli";
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
import Presenze from "../schermate/Presenze";
import Listino from "../schermate/Listino";
import Altro from "../schermate/Altro";
import Analisi from "../schermate/Analisi";
import StaffSchermata from "../schermate/Staff";

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

  /* Guardando da socio si guarda da socio davvero.

     Non bastava cambiare la barra in basso: WOD e Classi sono le
     stesse schermate per tutti, e dentro mostravano ancora l'editor
     del WOD e i bottoni per gestire le lezioni. Uno switch che dice
     "l'app come la vedono gli altri" e poi lascia lì i poteri non
     serve a niente, perche' e' proprio il controllo che vuoi fare.

     Qui il profilo viaggia spogliato: stessa persona, nessun ruolo.
     Le schermate continuano a chiedere "puo' fare questo?" come
     prima, e la risposta diventa no.

     E' una questione di cosa si vede, non di sicurezza: il database
     sa chi sei davvero e lo lascerebbe fare. Per quello esiste lo
     switch — per guardare, non per proteggersi da se stessi. */
  const poteri = comeStaff
    ? profilo
    : { ...profilo, ruolo: "socio", permessi: {} };

  const sezioni = comeStaff
    ? [
        { chiave: "oggi",    nome: "Oggi",    icona: IconaHome },
        { chiave: "soci",    nome: "Soci",    icona: Users },
        { chiave: "wod",     nome: "WOD",     icona: Dumbbell },
        { chiave: "prenota", nome: "Classi",  icona: CalendarDays },
        // Quinta voce: "Altro" a chi ci trova qualcosa dentro, il
        // profilo a chi no — un coach senza permessi in piu' ci
        // troverebbe solo il profilo, con un tocco in piu'.
        haGestione(profilo)
          ? { chiave: "altro",   nome: "Altro",   icona: LayoutGrid }
          : { chiave: "profilo", nome: "Profilo", icona: User },
      ]
    : [
        { chiave: "home",      nome: "Home",      icona: IconaHome },
        { chiave: "prenota",   nome: "Prenota",   icona: CalendarDays },
        { chiave: "wod",       nome: "WOD",       icona: Dumbbell },
        { chiave: "progressi", nome: "Progressi", icona: BarChart3 },
        { chiave: "profilo",   nome: "Profilo",   icona: User },
      ];

  // Da quale schermata si parte: dipende dal modo in cui si era
  // rimasti, non solo dall'essere staff. Guardando solo il ruolo si
  // apriva la schermata del titolare dentro la barra del socio,
  // finché non si toccava qualcosa.
  const [sezione, setSezione] = useState(() => (comeStaff ? "oggi" : "home"));
  const [lezione, setLezione] = useState(null);
  const [socio, setSocio] = useState(null);
  const [progressi, setProgressi] = useState(false);
  const [notifiche, setNotifiche] = useState(false);
  const [presenze, setPresenze] = useState(null);
  const [listino, setListino] = useState(false);
  const [staff2, setStaff2] = useState(false);
  const [analisi, setAnalisi] = useState(false);
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
    setPresenze(null);
    setListino(false);
    setStaff2(false);
    setAnalisi(false);
    setSezione(chiave);
  }

  function cambiaModo(nuovo) {
    setModo(nuovo);
    setLezione(null);
    setSocio(null);
    setProgressi(false);
    setNotifiche(false);
    setPresenze(null);
    setListino(false);
    setStaff2(false);
    setAnalisi(false);
    setSezione(nuovo === "staff" ? "oggi" : "home");
  }

  /* La barra in basso segue dove sei.

     Prima spegneva tutte le voci appena si apriva qualcosa che non
     fosse una delle cinque schermate principali: aprivi una lezione
     dal calendario e la barra diventava tutta grigia, come se non
     fossi da nessuna parte. Ma da qualche parte ci sei — sei dentro
     la sezione da cui sei entrato, e la barra deve dirlo.

     Adesso resta accesa la voce di partenza. Chi apre un dettaglio
     che ha una voce sua in barra ci va direttamente: vedi i Progressi
     qui sotto. */

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center px-5 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] border-b border-filo sticky top-0 bg-[#050507]/95 backdrop-blur z-20">
        <Logo altezza={26} />
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          {staff && <Interruttore modo={modo} onCambia={cambiaModo} profilo={profilo} />}
          <button
            onClick={() => { setNotifiche(true); setLezione(null); setSocio(null); setProgressi(false); setPresenze(null); setListino(false); setStaff2(false); setAnalisi(false); }}
            aria-label={daLeggere > 0 ? `Notifiche, ${daLeggere} da leggere` : "Notifiche"}
            className="relative text-neutral-300 p-0.5"
          >
            <Bell size={20} strokeWidth={1.7} />
            {daLeggere > 0 && (
              <span className="absolute top-0 right-0 w-[7px] h-[7px] rounded-full bg-neutral-50 ring-2 ring-[#050507]" />
            )}
          </button>
          <button
            onClick={() => vaiA("profilo")}
            aria-label="Il tuo profilo"
            className="w-9 h-9 rounded-full border border-neutral-600 overflow-hidden flex items-center justify-center shrink-0"
          >
            {profilo.foto_url ? (
              <img src={profilo.foto_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-display font-bold text-neutral-300">
                {(profilo.nome?.[0] ?? "") + (profilo.cognome?.[0] ?? "")}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto">
        {socio && analisi ? (
          <Socio
            socio={socio}
            onIndietro={() => setSocio(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
          />
        ) : analisi ? (
          <Analisi
            onIndietro={() => setAnalisi(false)}
            onApriSocio={setSocio}
          />
        ) : staff2 ? (
          <StaffSchermata
            profilo={profilo}
            onIndietro={() => setStaff2(false)}
            onMessaggio={avvisa}
          />
        ) : listino ? (
          <Listino onIndietro={() => setListino(false)} onMessaggio={avvisa} />
        ) : presenze ? (
          <Presenze
            sessione={presenze}
            onIndietro={() => setPresenze(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
          />
        ) : notifiche ? (
          <Notifiche onIndietro={() => setNotifiche(false)} onLette={contaNotifiche} />
        ) : lezione ? (
          <Lezione
            sessione={lezione}
            onIndietro={() => setLezione(null)}
            onCambiato={() => setVersione((v) => v + 1)}
            onMessaggio={avvisa}
            onApriPresenze={comeStaff ? setPresenze : undefined}
            poteri={poteri}
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
            onApriPresenze={setPresenze}
            ricarica={versione}
          />
        ) : sezione === "home" ? (
          <Home
            onVaiAlCalendario={() => vaiA("prenota")}
            onVaiAlProfilo={() => vaiA("profilo")}
            onVaiAiProgressi={() =>
              // Il socio ha i Progressi in barra: ci si va, e la barra
              // lo segue. Lo staff no — lì si apre sopra, con "Altro"
              // che resta acceso.
              comeStaff ? setProgressi(true) : vaiA("progressi")
            }
            onVaiAlWod={() => vaiA("wod")}
            onApriLezione={setLezione}
            ricarica={versione}
            poteri={poteri}
          />
        ) : sezione === "prenota" ? (
          <Prenota
            onApri={setLezione}
            ricarica={versione}
            onMessaggio={avvisa}
            poteri={poteri}
          />
        ) : sezione === "wod" ? (
          <Wod
            giornoIniziale={oggi()}
            onMessaggio={avvisa}
            poteri={poteri}
            comeStaff={comeStaff}
          />
        ) : sezione === "progressi" ? (
          <Progressi onMessaggio={avvisa} />
        ) : sezione === "soci" ? (
          <Soci onApri={setSocio} ricarica={versione} />
        ) : sezione === "altro" ? (
          <Altro
            onApri={(dove) => {
              if (dove === "analisi") setAnalisi(true);
              else if (dove === "staff") setStaff2(true);
              else if (dove === "listino") setListino(true);
              else if (dove === "progressi") setProgressi(true);
            }}
            onVaiAlProfilo={() => vaiA("profilo")}
          />
        ) : (
          // In modo staff i progressi non stanno in barra: si arriva
          // qui dal profilo.
          <Profilo />
        )}
      </main>

      <Messaggio testo={messaggio} />

      <nav className="fixed bottom-0 left-0 right-0 border-t border-filo bg-[#050507]/95 backdrop-blur z-20 pb-[env(safe-area-inset-bottom)]">
        <div
          className="max-w-md mx-auto grid"
          style={{ gridTemplateColumns: `repeat(${sezioni.length}, minmax(0, 1fr))` }}
        >
          {sezioni.map(({ chiave, nome, icona: Icona }) => {
            const attiva = sezione === chiave;
            return (
              <button
                key={chiave}
                onClick={() => vaiA(chiave)}
                className={`flex flex-col items-center gap-1 pt-3 pb-2.5 relative ${
                  attiva ? "text-neutral-50" : "text-neutral-600"
                }`}
              >
                {/* Niente riempimento.

                    Riempire funziona solo sulle icone che sono un
                    contorno chiuso, tipo la casa. Quelle fatte di
                    linee aperte — il grafico dei progressi, il
                    bilanciere — vengono chiuse d'ufficio e si
                    riempiono a metà: il grafico diventava un
                    triangolo pieno che si mangiava mezza icona.

                    Che la voce sia quella attiva si vede lo stesso da
                    tre cose: il bianco, il tratto più spesso e la
                    lineetta qui sotto. */}
                <Icona size={19} strokeWidth={attiva ? 2.3 : 1.7} />
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
          <div className="absolute right-0 mt-2.5 w-56 bg-scheda border border-bordo rounded-2xl p-1.5 z-20 shadow-xl shadow-black/60">
            <div className="px-3 py-2 text-[9.5px] text-neutral-500 tracking-[0.15em] font-semibold">
              VISUALIZZA COME
            </div>
            {voci.map((v) => (
              <button
                key={v.chiave}
                onClick={() => { onCambia(v.chiave); setAperto(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl ${
                  modo === v.chiave ? "bg-rilievo" : ""
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
