/* Le presenze: quello che lo staff chiede al database a fine classe.

   La regola di chi può fare cosa non sta qui — sta nel database. Un
   coach chiude le classi che tiene lui e basta; se qui provassimo a
   decidere noi, chi conosce l'indirizzo del database potrebbe
   scavalcarci. Queste funzioni chiedono, il database risponde sì o
   no. */

import { supabase } from "./supabase";

/** Le classi già cominciate e ancora senza presenze confermate.
    Ognuno vede solo quelle che può chiudere davvero. */
export async function classiDaChiudere(quantiGiorni = 7) {
  const { data, error } = await supabase.rpc("classi_da_chiudere", {
    quanti_giorni: quantiGiorni,
  });
  if (error) throw error;
  return data ?? [];
}

/** La lista da spuntare: prima i prenotati, in fondo la lista
    d'attesa. */
export async function elencoPresenze(sessioneId) {
  const { data, error } = await supabase.rpc("elenco_presenze", {
    sess: sessioneId,
  });
  if (error) throw error;
  return data ?? [];
}

/** Posso chiudere questa classe? Serve a mostrare o nascondere il
    bottone: il no vero lo dice comunque il database. */
export async function possoChiudere(sessioneId) {
  const { data, error } = await supabase.rpc("posso_chiudere", {
    sess: sessioneId,
  });
  if (error) throw error;
  return data === true;
}

/** Conferma. Arriva l'elenco di chi c'era; tutti gli altri fra i
    prenotati diventano assenti. Torna quanti presenti risultano. */
export async function segnaPresenze(sessioneId, idPresenti) {
  const { data, error } = await supabase.rpc("segna_presenze", {
    sess: sessioneId,
    presenti: idPresenti,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Chi arriva senza prenotazione. Entra solo se c'è posto. */
export async function aggiungiAllaClasse(sessioneId, socioId) {
  const { error } = await supabase.rpc("aggiungi_alla_classe", {
    sess: sessioneId,
    socio: socioId,
  });
  if (error) throw error;
}

/** Toglie qualcuno dalla classe: serve a rimediare agli errori. */
export async function togliDallaClasse(sessioneId, socioId) {
  const { error } = await supabase.rpc("togli_dalla_classe", {
    sess: sessioneId,
    socio: socioId,
  });
  if (error) throw error;
}

/* ----------------------------------------------------------------
   Il messaggio da mostrare quando il database dice no.

   Gli errori arrivano in italiano perché li scriviamo noi nelle
   funzioni del database; questa funzione li riconosce e aggiunge il
   cosa fare, perché "non puoi" da solo lascia lo staff a chiedersi
   perché.
   ---------------------------------------------------------------- */

export function spiega(e) {
  const t = String(e?.message || "");
  if (t.includes("non puoi") || t.includes("Non puoi")) {
    return "Questa classe la chiude il coach che la tiene, o un amministratore.";
  }
  if (t.includes("completo")) {
    return "La classe è al completo: non c'è posto per aggiungere nessuno.";
  }
  return "Qualcosa non ha funzionato. Riprova fra poco.";
}
