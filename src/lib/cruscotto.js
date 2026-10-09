/* La situazione di oggi, per chi apre il box. */

import { supabase } from "./supabase";

export async function numeriDiOggi() {
  const { data, error } = await supabase.rpc("cruscotto");
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function attivitaDiOggi() {
  const { data, error } = await supabase.rpc("attivita_oggi");
  if (error) throw error;
  return data ?? [];
}

export async function andamento(giorni = 7) {
  const { data, error } = await supabase.rpc("andamento", { giorni });
  if (error) throw error;
  return data ?? [];
}

/** Quanto sono piene le classi di oggi, in percentuale. */
export function riempimento(n) {
  if (!n || !n.posti_oggi) return null;
  return Math.round((n.prenotati_oggi / n.posti_oggi) * 100);
}
