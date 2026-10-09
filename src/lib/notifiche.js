/* Notifiche e comunicazioni dal box. */

import { supabase } from "./supabase";

export async function mieNotifiche(limite = 30) {
  const { data, error } = await supabase
    .from("notifiche")
    .select("id, gruppo, titolo, testo, letta_il, creata_il")
    .order("creata_il", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function quanteDaLeggere() {
  const { count, error } = await supabase
    .from("notifiche")
    .select("id", { count: "exact", head: true })
    .is("letta_il", null);
  if (error) throw error;
  return count ?? 0;
}

export async function segnaLette(ids) {
  if (!ids?.length) return;
  const { error } = await supabase
    .from("notifiche")
    .update({ letta_il: new Date().toISOString() })
    .in("id", ids)
    .is("letta_il", null);
  if (error) throw error;
}

export async function comunicazioni(limite = 10) {
  const { data, error } = await supabase
    .from("comunicazioni")
    .select("id, tipo, titolo, testo, pubblicata_il")
    .order("pubblicata_il", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

/** "2 ore fa", "ieri", "3 giorni fa". */
export function quantoFa(iso) {
  const minuti = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuti < 2) return "adesso";
  if (minuti < 60) return `${minuti} minuti fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return ore === 1 ? "un'ora fa" : `${ore} ore fa`;
  const giorni = Math.round(ore / 24);
  if (giorni === 1) return "ieri";
  if (giorni < 30) return `${giorni} giorni fa`;
  const mesi = Math.round(giorni / 30);
  return mesi === 1 ? "un mese fa" : `${mesi} mesi fa`;
}
