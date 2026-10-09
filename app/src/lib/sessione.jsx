import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, configurato } from "./supabase";

/* Tiene in un posto solo la risposta a "chi sta usando l'app adesso":
   l'account di accesso e la sua scheda socio. Ogni schermata la legge
   da qui invece di richiederla al database per conto proprio. */

const Contesto = createContext(null);

export function ProviderSessione({ children }) {
  const [caricamento, setCaricamento] = useState(true);
  const [utente, setUtente] = useState(null);     // account (email, id)
  const [profilo, setProfilo] = useState(null);   // scheda socio

  const caricaProfilo = useCallback(async (id) => {
    if (!id) {
      setProfilo(null);
      return null;
    }
    const { data } = await supabase
      .from("profili")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setProfilo(data ?? null);
    return data ?? null;
  }, []);

  useEffect(() => {
    if (!configurato) {
      setCaricamento(false);
      return;
    }

    let vivo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      const u = data.session?.user ?? null;
      setUtente(u);
      await caricaProfilo(u?.id);
      if (vivo) setCaricamento(false);
    });

    // Scatta a ogni accesso, uscita e rinnovo del collegamento.
    const { data: iscrizione } = supabase.auth.onAuthStateChange(
      async (_evento, sessione) => {
        if (!vivo) return;
        const u = sessione?.user ?? null;
        setUtente(u);
        await caricaProfilo(u?.id);
      }
    );

    return () => {
      vivo = false;
      iscrizione.subscription.unsubscribe();
    };
  }, [caricaProfilo]);

  const valore = {
    caricamento,
    utente,
    profilo,
    ricaricaProfilo: () => caricaProfilo(utente?.id),
    esci: async () => {
      await supabase.auth.signOut();
      setUtente(null);
      setProfilo(null);
    },
  };

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useSessione() {
  const v = useContext(Contesto);
  if (!v) throw new Error("useSessione va usato dentro ProviderSessione");
  return v;
}
