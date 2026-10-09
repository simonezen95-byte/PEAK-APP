/* Quello che la reception chiede al database. Come per le
   prenotazioni, le schermate passano tutte di qui. */

import { supabase } from "./supabase";

export function eStaff(profilo) {
  return ["coach", "admin", "owner"].includes(profilo?.ruolo);
}

export function puoGestireAbbonamenti(profilo) {
  if (!profilo) return false;
  if (profilo.ruolo === "owner" || profilo.ruolo === "admin") return true;
  return profilo.permessi?.abb_edit === true;
}

export function puoApprovare(profilo) {
  if (!profilo) return false;
  if (profilo.ruolo === "owner" || profilo.ruolo === "admin") return true;
  return profilo.permessi?.soci_approve === true
      || profilo.permessi?.soci_edit === true;
}

/** L'elenco dei soci, con accanto certificato, quota e abbonamento. */
export async function elencoSoci(cerca = "") {
  const { data, error } = await supabase.rpc("soci_elenco", { cerca });
  if (error) throw error;
  return data ?? [];
}

export async function storicoSocio(socioId) {
  const { data, error } = await supabase.rpc("socio_storico", { socio: socioId });
  if (error) throw error;
  return data ?? [];
}

export async function catalogo() {
  const { data, error } = await supabase
    .from("pacchetti")
    .select("id, nome, tipo, prezzo, mesi, ingressi, include_classi, sessioni")
    .eq("attivo", true)
    .order("tipo")
    .order("prezzo");
  if (error) throw error;
  return data ?? [];
}

/** Approvare, sospendere, riattivare. Chi e quando lo registra il
    database da solo. */
export async function cambiaStato(socioId, stato) {
  const { error } = await supabase
    .from("profili")
    .update({ stato })
    .eq("id", socioId);
  if (error) throw error;
}

export async function registraCertificato(socioId, scadenzaIso) {
  const { error } = await supabase
    .from("profili")
    .update({ certificato_scadenza: scadenzaIso })
    .eq("id", socioId);
  if (error) throw error;
}

/** La stagione sportiva chiude il 31 agosto: la quota versata a
    ottobre 2026 vale per la stagione 2027. */
export function stagioneCorrente(oggi = new Date()) {
  return oggi.getMonth() >= 8 ? oggi.getFullYear() + 1 : oggi.getFullYear();
}

export async function registraQuota(socioId, anno, importo) {
  const { error } = await supabase
    .from("quote")
    .insert({ profilo_id: socioId, anno_sportivo: anno, importo });
  if (error) throw error;
}

/** Attiva un abbonamento a partire da una data, calcolando la fine
    dai mesi del pacchetto. */
export async function attivaAbbonamento(socioId, pacchetto, inizioIso, pagato) {
  const inizio = new Date(inizioIso);
  const fine = new Date(inizio);
  fine.setMonth(fine.getMonth() + (pacchetto.mesi ?? 1));
  fine.setDate(fine.getDate() - 1);

  const p = (n) => String(n).padStart(2, "0");
  const fineIso = `${fine.getFullYear()}-${p(fine.getMonth() + 1)}-${p(fine.getDate())}`;

  const conteggio = pacchetto.tipo === "personal"
    ? pacchetto.sessioni
    : pacchetto.ingressi;

  const { error } = await supabase.from("abbonamenti").insert({
    profilo_id: socioId,
    pacchetto_id: pacchetto.id,
    tipo: pacchetto.tipo,
    inizio: inizioIso,
    fine: fineIso,
    pagato,
    residui: conteggio ?? null,
    totali: conteggio ?? null,
  });
  if (error) throw error;
  return fineIso;
}
