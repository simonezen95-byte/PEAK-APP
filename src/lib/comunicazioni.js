/* Le comunicazioni della palestra: gli avvisi che compaiono nella home
   del socio e, se si vuole, anche sul suo telefono.

   Chi può fare cosa lo decide il database, non queste funzioni: qui si
   chiede e basta. Le regole stanno in `db/34-comunicazioni.sql`. */

import { supabase } from "./supabase";
import { puo } from "./ruoli";

/** Scrivere in bacheca: l'avviso resta dentro l'app. */
export function puoScrivere(profilo) {
  return puo(profilo, "com_board") || puo(profilo, "com_send");
}

/** Far squillare i telefoni. È un permesso a parte di proposito:
    scrivere "è arrivato il rack nuovo" e svegliare cinquanta persone
    di sera sono due gesti diversi. */
export function puoAvvisare(profilo) {
  return puo(profilo, "com_send");
}

/** Le comunicazioni pubblicate, dalla più recente. Per la console:
    dice anche chi l'ha scritta e quanti l'hanno ricevuta. */
export async function elenco(quante = 30) {
  const { data, error } = await supabase.rpc("comunicazioni_elenco", { quante });
  if (error) throw error;
  return data ?? [];
}

/** Quanti soci e quanti telefoni raggiungerei pubblicando adesso.
    Serve prima di decidere, non dopo. */
export async function quantiAvviserei() {
  const { data, error } = await supabase.rpc("quanti_avviserei");
  if (error) throw error;
  return data?.[0] ?? { soci: 0, raggiungibili: 0 };
}

export async function pubblica({ titolo, testo, tipo = "comunicazione", avvisa = false }) {
  const { data, error } = await supabase.rpc("pubblica_comunicazione", {
    p_titolo: titolo,
    p_testo: testo,
    p_tipo: tipo,
    avvisa,
  });
  if (error) throw error;
  return data;
}

export async function togli(id) {
  const { error } = await supabase.rpc("togli_comunicazione", { com: id });
  if (error) throw error;
}

/** "oggi", "ieri", "3 giorni fa". Le comunicazioni si leggono a colpo
    d'occhio: una data per esteso costringerebbe a fare il conto. */
export function quando(iso) {
  const q = new Date(iso);
  const giorni = Math.floor((Date.now() - q.getTime()) / 86400000);
  if (giorni <= 0) {
    const ore = Math.floor((Date.now() - q.getTime()) / 3600000);
    if (ore < 1) return "poco fa";
    return ore === 1 ? "un'ora fa" : `${ore} ore fa`;
  }
  if (giorni === 1) return "ieri";
  if (giorni < 30) return `${giorni} giorni fa`;
  return q.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}
