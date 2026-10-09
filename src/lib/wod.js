/* Il WOD: lettura, scrittura e classifica. */

import { supabase } from "./supabase";

export const VARIANTI = ["RX", "SCALED", "OPEN"];

export async function wodDelGiorno(giornoIso) {
  const { data, error } = await supabase.rpc("wod_giorno", { giorno: giornoIso });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function giorniConWod(dalIso, alIso) {
  const { data, error } = await supabase.rpc("wod_giorni", { dal: dalIso, al: alIso });
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.data));
}

export async function classifica(giornoIso) {
  const { data, error } = await supabase.rpc("wod_classifica", { giorno: giornoIso });
  if (error) throw error;
  return data ?? [];
}

export async function salvaWod(giornoIso, w) {
  const { data, error } = await supabase.rpc("salva_wod", {
    giorno: giornoIso,
    p_titolo: w.titolo,
    p_tipo: w.tipo_score,
    p_time_cap: w.time_cap || null,
    p_warm_up: w.warm_up || null,
    p_varianti: w.varianti,
  });
  if (error) throw error;
  return data;
}

export async function cancellaWod(giornoIso) {
  const { error } = await supabase.rpc("cancella_wod", { giorno: giornoIso });
  if (error) throw error;
}

export async function salvaScore(wodId, profiloId, variante, valore, privato) {
  const { error } = await supabase
    .from("wod_score")
    .upsert(
      { wod_id: wodId, profilo_id: profiloId, variante, valore, privato },
      { onConflict: "wod_id,profilo_id" }
    );
  if (error) throw error;
}

export async function togliScore(wodId, profiloId) {
  const { error } = await supabase
    .from("wod_score")
    .delete()
    .eq("wod_id", wodId)
    .eq("profilo_id", profiloId);
  if (error) throw error;
}

export function puoScrivereWod(profilo) {
  if (!profilo) return false;
  if (profilo.ruolo === "owner" || profilo.ruolo === "admin") return true;
  return profilo.permessi?.wod_write === true;
}

/* ----------------------------------------------------------------
   Lo score è un numero solo, ma vuol dire tre cose diverse: secondi
   per i WOD a tempo, ripetizioni, chili. Qui si passa dal numero a
   come si scrive e viceversa.
   ---------------------------------------------------------------- */

export function scriviScore(valore, tipo) {
  if (valore == null) return "";
  if (tipo === "tempo") {
    const s = Math.round(Number(valore));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }
  const n = Number(valore);
  const testo = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return tipo === "carico" ? `${testo} kg` : testo;
}

/** Da "3:45" a 225 secondi. Da "150" a 150. Null se non si capisce. */
export function leggiScore(testo, tipo) {
  const t = String(testo).trim().replace(",", ".");
  if (!t) return null;

  if (tipo === "tempo") {
    if (t.includes(":")) {
      const [m, s] = t.split(":");
      const mm = Number(m), ss = Number(s);
      if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss >= 60) return null;
      return mm * 60 + ss;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;   // già in secondi
  }

  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function unitaScore(tipo) {
  return tipo === "tempo" ? "minuti:secondi"
       : tipo === "carico" ? "chili"
       : "ripetizioni";
}

export function nomeTipo(tipo) {
  return tipo === "tempo" ? "A tempo"
       : tipo === "carico" ? "A carico"
       : "A ripetizioni";
}
