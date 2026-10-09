import { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Logo, Campo, Bottone, Avviso } from "../ui/base";

export default function Accesso({ onRegistrati }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visibile, setVisibile] = useState(false);
  const [carica, setCarica] = useState(false);
  const [errore, setErrore] = useState("");
  const [inviata, setInviata] = useState(false);

  async function entra(e) {
    e.preventDefault();
    setErrore("");
    setCarica(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setCarica(false);
    // Il messaggio di Supabase è in inglese e dice troppo: non si
    // deve capire se un indirizzo esiste o no.
    if (error) setErrore("Email o password non corretti.");
    // Se va a buon fine non serve fare altro: la sessione se ne accorge
    // da sola e l'app cambia schermata.
  }

  async function recuperaPassword() {
    if (!email.trim()) {
      setErrore("Scrivi la tua email, poi tocca di nuovo qui.");
      return;
    }
    setErrore("");
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    // Risposta identica anche se l'indirizzo non esiste.
    setInviata(true);
  }

  return (
    <form onSubmit={entra} className="min-h-full flex flex-col px-6 py-10 max-w-sm mx-auto w-full">
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex flex-col items-center mb-10">
          <Logo altezza={58} />
          <p className="text-[12.5px] text-neutral-500 mt-5 tracking-wide">
            Find your peak. Become your peak.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Campo
            icona={Mail}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <Campo
            icona={Lock}
            autoComplete="current-password"
            mostraOcchio
            visibile={visibile}
            onOcchio={() => setVisibile((v) => !v)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>

        <div className="flex justify-end mt-3 mb-5">
          <button
            type="button"
            onClick={recuperaPassword}
            className="text-[12px] text-neutral-400 hover:text-neutral-200"
          >
            Password dimenticata?
          </button>
        </div>

        {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}
        {inviata && (
          <div className="mb-4">
            <Avviso tono="nota">
              Se quell'indirizzo è registrato, trovi una email con il link per
              scegliere una nuova password.
            </Avviso>
          </div>
        )}

        <Bottone type="submit" carica={carica} disabled={!email || !password}>
          ACCEDI
        </Bottone>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-rilievo" />
          <span className="text-[11px] text-neutral-600">oppure</span>
          <div className="h-px flex-1 bg-rilievo" />
        </div>

        <Bottone type="button" variante="vuoto" onClick={onRegistrati}>
          CREA ACCOUNT
        </Bottone>
      </div>

      <p className="text-[11px] text-neutral-600 text-center leading-relaxed mt-10">
        PEAK Functional Fitness A.S.D.
        <br />
        Via Enrico Mattei 18 · Maser (TV)
      </p>
    </form>
  );
}
