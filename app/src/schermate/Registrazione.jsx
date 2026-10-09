import { useState } from "react";
import { ChevronLeft, User, Mail, Lock, Phone } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useSessione } from "../lib/sessione";
import { Campo, Bottone, Avviso, Spunta, DataNascita } from "../ui/base";
import Informativa, { VERSIONE_INFORMATIVA } from "./Informativa";

export default function Registrazione({ onIndietro }) {
  const { ricaricaProfilo } = useSessione();
  const [d, setD] = useState({
    nome: "", cognome: "", email: "", telefono: "",
    nascita: "", password: "", conferma: "",
  });
  const [visibile, setVisibile] = useState(false);
  const [informativa, setInformativa] = useState(false);
  const [foto, setFoto] = useState(false);
  const [leggiInformativa, setLeggiInformativa] = useState(false);
  const [carica, setCarica] = useState(false);
  const [errore, setErrore] = useState("");

  const set = (campo) => (e) =>
    setD((p) => ({ ...p, [campo]: e.target?.value ?? e }));

  const passwordCorta = d.password.length > 0 && d.password.length < 8;
  const passwordDiverse = d.conferma.length > 0 && d.password !== d.conferma;

  const completo =
    d.nome.trim() && d.cognome.trim() && d.email.trim() && d.telefono.trim() &&
    d.nascita && d.password.length >= 8 && d.password === d.conferma && informativa;

  async function registra(e) {
    e.preventDefault();
    setErrore("");
    setCarica(true);

    // 1. L'account di accesso. Email e password le custodisce Supabase,
    //    cifrate: non passano mai dal nostro database.
    const { data: reg, error: erroreAuth } = await supabase.auth.signUp({
      email: d.email.trim(),
      password: d.password,
    });

    if (erroreAuth) {
      setCarica(false);
      setErrore(
        erroreAuth.message?.toLowerCase().includes("already")
          ? "Esiste già un account con questa email. Prova ad accedere."
          : "Non è stato possibile creare l'account. Riprova fra poco."
      );
      return;
    }

    const utente = reg.user;

    // Se Supabase è impostato per chiedere la conferma via email, qui
    // l'account esiste ma non si è ancora collegati, e senza
    // collegamento la scheda socio non si può salvare.
    if (!utente || !reg.session) {
      setCarica(false);
      setErrore(
        "Account creato. Conferma l'indirizzo dalla email che ti abbiamo " +
          "mandato, poi accedi per completare l'iscrizione."
      );
      return;
    }

    // 2. A quale palestra iscriversi. La chiede al database perché a
    //    questo punto la scheda socio non esiste ancora, e senza scheda
    //    l'elenco delle palestre non è leggibile.
    const { data: boxId, error: erroreBox } = await supabase.rpc("box_di_default");
    if (erroreBox || !boxId) {
      setCarica(false);
      setErrore("Problema di collegamento con la palestra. Riprova fra poco.");
      return;
    }

    // 3. La scheda socio. Nasce "in attesa": è l'admin che approva.
    const { error: erroreProfilo } = await supabase.from("profili").insert({
      id: utente.id,
      box_id: boxId,
      nome: d.nome.trim(),
      cognome: d.cognome.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      data_nascita: d.nascita,
    });

    if (erroreProfilo) {
      setCarica(false);
      setErrore("Account creato ma scheda non salvata. Scrivici e la sistemiamo.");
      return;
    }

    // 4. I consensi, uno per riga: serve poter dimostrare chi ha
    //    accettato cosa e quando.
    const consensi = [
      { profilo_id: utente.id, tipo: "informativa",
        versione: VERSIONE_INFORMATIVA, accettato: true },
    ];
    if (foto) {
      consensi.push({ profilo_id: utente.id, tipo: "foto_video",
        versione: VERSIONE_INFORMATIVA, accettato: true });
    }
    await supabase.from("consensi").insert(consensi);

    // La sessione si è accorta dell'accesso prima che la scheda
    // esistesse: glielo faccio rileggere, così la schermata di attesa
    // sa già come ti chiami.
    await ricaricaProfilo();
    setCarica(false);
    // Da qui in poi se ne accorge la sessione: compare la schermata
    // di attesa approvazione.
  }

  if (leggiInformativa) {
    return <Informativa onIndietro={() => setLeggiInformativa(false)} />;
  }

  return (
    <form onSubmit={registra} className="min-h-full px-6 py-8 max-w-sm mx-auto w-full">
      <button
        type="button"
        onClick={onIndietro}
        aria-label="Torna all'accesso"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <h1 className="font-display font-bold text-[22px] text-neutral-50 mt-2">
        Crea account
      </h1>
      <p className="text-[12.5px] text-neutral-400 mt-1.5 mb-7 leading-relaxed">
        Compila i tuoi dati per chiedere l'accesso. Lo staff approva
        l'iscrizione in reception, quando porti il certificato medico.
      </p>

      <div className="flex flex-col gap-3">
        <Campo icona={User} autoComplete="given-name"
               value={d.nome} onChange={set("nome")} placeholder="Nome" />
        <Campo icona={User} autoComplete="family-name"
               value={d.cognome} onChange={set("cognome")} placeholder="Cognome" />
        <Campo icona={Mail} type="email" inputMode="email" autoComplete="email"
               value={d.email} onChange={set("email")} placeholder="Email" />
        <Campo icona={Phone} type="tel" inputMode="tel" autoComplete="tel"
               value={d.telefono} onChange={set("telefono")} placeholder="Telefono" />
        <DataNascita valore={d.nascita} onChange={(v) => setD((p) => ({ ...p, nascita: v }))} />
        <Campo icona={Lock} autoComplete="new-password" mostraOcchio
               visibile={visibile} onOcchio={() => setVisibile((v) => !v)}
               value={d.password} onChange={set("password")} placeholder="Password" />
        <Campo icona={Lock} autoComplete="new-password" mostraOcchio
               visibile={visibile} onOcchio={() => setVisibile((v) => !v)}
               value={d.conferma} onChange={set("conferma")} placeholder="Conferma password" />
      </div>

      <p className="text-[11px] mt-2.5 ml-1 text-neutral-500">
        {passwordCorta
          ? <span className="text-amber-400">La password deve avere almeno 8 caratteri.</span>
          : passwordDiverse
          ? <span className="text-amber-400">Le due password non coincidono.</span>
          : "Almeno 8 caratteri."}
      </p>

      <p className="text-[11px] text-neutral-500 leading-relaxed mt-5 mb-4">
        Telefono e data di nascita servono allo staff: il primo per avvisarti
        se cambia qualcosa, la seconda per il tesseramento.
      </p>

      <div className="flex flex-col gap-3 mb-6">
        <Spunta attiva={informativa} onChange={() => setInformativa((v) => !v)}>
          Dichiaro di aver letto e accettato l'
          <button type="button" onClick={() => setLeggiInformativa(true)}
                  className="text-neutral-100 underline underline-offset-2">
            informativa privacy
          </button>
          <span className="text-neutral-500"> · obbligatorio</span>
        </Spunta>

        <Spunta attiva={foto} onChange={() => setFoto((v) => !v)}>
          Acconsento alla pubblicazione di foto e video che mi ritraggono sui
          canali PEAK
          <span className="text-neutral-500"> · facoltativo, revocabile in ogni momento</span>
        </Spunta>
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <Bottone type="submit" carica={carica} disabled={!completo}>
        RICHIEDI L'ACCESSO
      </Bottone>
    </form>
  );
}
