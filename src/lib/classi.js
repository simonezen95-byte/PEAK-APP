/* Gestire una lezione: annullarla, cambiarne la capienza, assegnare
   il coach, aggiungerne una fuori palinsesto.

   Come sempre, le regole stanno nel database: qui si chiede e basta.
   L'annullamento in particolare non è una riga da cambiare ma tre
   cose insieme — segno, disdette, avvisi — e devono riuscire o
   fallire tutte, quindi le fa il database in un colpo solo. */

import { supabase } from "./supabase";

/** Annulla e avvisa chi era prenotato. Torna quanti sono stati
    avvisati. */
export async function annullaClasse(sessioneId, motivo) {
  const { data, error } = await supabase.rpc("annulla_classe", {
    sess: sessioneId,
    motivo: motivo?.trim() || null,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Rimette in programma una lezione annullata per sbaglio. Le
    prenotazioni non tornano: chi c'era viene avvisato e decide lui. */
export async function riapriClasse(sessioneId) {
  const { data, error } = await supabase.rpc("riapri_classe", {
    sess: sessioneId,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Cambia i posti. Torna quanti sono entrati dalla lista d'attesa. */
export async function cambiaCapienza(sessioneId, nuova) {
  const { data, error } = await supabase.rpc("cambia_capienza", {
    sess: sessioneId,
    nuova,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function assegnaCoach(sessioneId, coachId) {
  const { error } = await supabase.rpc("assegna_coach", {
    sess: sessioneId,
    coach: coachId,
  });
  if (error) throw error;
}

export async function elencoCoach() {
  const { data, error } = await supabase.rpc("elenco_coach");
  if (error) throw error;
  return data ?? [];
}

export async function aggiungiLezione({
  giorno, ora, nome, capienza, durata, tipo = "classe", coach = null,
}) {
  const { data, error } = await supabase.rpc("aggiungi_lezione", {
    giorno, ora, nome, capienza, durata, tipo, coach,
  });
  if (error) throw error;
  return data;
}

export function puoGestireClassi(profilo) {
  if (!profilo) return false;
  if (profilo.ruolo === "owner" || profilo.ruolo === "admin") return true;
  return profilo.permessi?.cl_edit === true;
}

/* Gli errori arrivano già in italiano dal database, perché li
   scriviamo noi dentro le funzioni. Qui si lasciano passare tali e
   quali quando sono nostri, e si traduce solo il resto. */
export function spiega(e) {
  const t = String(e?.message || "");
  if (!t) return "Qualcosa non ha funzionato. Riprova fra poco.";
  if (t.includes("row-level security")) {
    return "Non hai il permesso di fare questa modifica.";
  }
  // I messaggi scritti da noi cominciano con una maiuscola e
  // finiscono con un punto: sono già pronti da leggere.
  if (/^[A-ZÀ-Ù].*[.!]$/.test(t)) return t;
  return "Qualcosa non ha funzionato. Riprova fra poco.";
}
