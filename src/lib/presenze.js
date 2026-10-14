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

/* Conferma. Arrivano le RIGHE spuntate, non i soci.

   Prima si passavano i soci presenti, ma un utente prova non ha un
   socio da passare e sarebbe risultato sempre assente. Le righe della
   lista invece ce le hanno tutti. */
export async function segnaPresenze(sessioneId, idRighe) {
  const { data, error } = await supabase.rpc("segna_presenze", {
    sess: sessioneId,
    righe: idRighe,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Chi viene a provare: occupa un posto, non è un socio, non lascia
    nessun dato suo. Torna l'identificativo della riga creata. */
export async function aggiungiProva(sessioneId) {
  const { data, error } = await supabase.rpc("aggiungi_prova", {
    sess: sessioneId,
  });
  if (error) throw error;
  return data;
}

/** Toglie una riga qualsiasi dalla classe, socio o prova che sia.
    Per le prove serve per forza: non hanno un socio da nominare. */
export async function togliRiga(rigaId) {
  const { error } = await supabase.rpc("togli_riga", { riga: rigaId });
  if (error) throw error;
}

/** Quante persone sono venute a provare, fra due date. */
export async function quanteProve(dalIso, alIso) {
  const { data, error } = await supabase.rpc("quante_prove", {
    dal: dalIso, al: alIso,
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
