/* Massimali e risultati: quello che il socio guarda nel tempo. */

import { supabase } from "./supabase";

export const TIPI_MASSIMALE = ["1RM", "2RM", "3RM", "5RM", "10RM"];

export async function mieiMassimali() {
  const { data, error } = await supabase.rpc("miei_massimali");
  if (error) throw error;
  return data ?? [];
}

export async function storicoMassimale(esercizioId, tipo) {
  const { data, error } = await supabase.rpc("storico_massimale", {
    esercizio: esercizioId,
    p_tipo: tipo,
  });
  if (error) throw error;
  return data ?? [];
}

export async function storicoWod(limite = 30) {
  const { data, error } = await supabase.rpc("mio_storico_wod", { limite });
  if (error) throw error;
  return data ?? [];
}

export async function mieiAllenamenti() {
  const { data, error } = await supabase.rpc("miei_allenamenti");
  if (error) throw error;
  return data?.[0] ?? null;
}

/** La libreria degli esercizi: quelli di base più quelli aggiunti
    dalla palestra. */
export async function esercizi() {
  const { data, error } = await supabase
    .from("esercizi")
    .select("id, nome, categoria")
    .order("categoria")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function salvaMassimale(profiloId, esercizioId, tipo, valore, dataIso) {
  const { error } = await supabase.from("pr").insert({
    profilo_id: profiloId,
    esercizio_id: esercizioId,
    tipo,
    valore,
    data: dataIso,
  });
  if (error) throw error;
}

export async function togliMassimale(id) {
  const { error } = await supabase.from("pr").delete().eq("id", id);
  if (error) throw error;
}

/** Esercizio nuovo, aggiunto dal socio: resta legato alla palestra,
    non alla libreria di base. */
export async function aggiungiEsercizio(boxId, nome, categoria, profiloId) {
  const { data, error } = await supabase
    .from("esercizi")
    .insert({ box_id: boxId, nome: nome.trim(), categoria, creato_da: profiloId })
    .select("id, nome, categoria")
    .single();
  if (error) throw error;
  return data;
}

/** Da 130 a "130 kg", senza decimali inutili. */
export function kg(valore) {
  const n = Number(valore);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;
}
