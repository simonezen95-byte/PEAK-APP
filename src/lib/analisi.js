/* L'analisi: quello che lo staff chiede al database per capire come
   sta andando.

   Qui non si calcola niente. I numeri li fa il database, perché la
   stessa domanda deve dare la stessa risposta da qualunque parte
   arrivi — dall'app, da un'altra schermata, o fra due anni da un
   programma che oggi non esiste. Se li calcolassimo qui, la regola
   vivrebbe dentro un telefono. */

import { supabase } from "./supabase";

/** I numeri in testa alla schermata.

    Vuole le stesse finestre delle due liste: se un numero grande
    guardasse sempre tre settimane mentre la lista sotto ne guarda
    sei, uno dei due direbbe il falso.

    I primi tre stanno in piedi da soli: attivi + fermi + appena
    arrivati fa esattamente il totale dei soci, a qualunque
    finestra. */
export async function analisiSoci(settimane = 3, giorni = 30) {
  const { data, error } = await supabase.rpc("analisi_soci", { settimane, giorni });
  if (error) throw error;
  // Torna una riga sola, o nessuna se chi guarda non ha il permesso.
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

/** Chi non si allena da un po'. In cima chi paga e non viene. */
export async function sociFermi(settimane = 3) {
  const { data, error } = await supabase.rpc("soci_fermi", { settimane });
  if (error) throw error;
  return data ?? [];
}

/** Cosa sta scadendo: certificati, quote, abbonamenti, in ordine di
    data. Comprende quello scaduto da poco, che è il più urgente. */
export async function scadenzeProssime(giorni = 30) {
  const { data, error } = await supabase.rpc("scadenze_prossime", { giorni });
  if (error) throw error;
  return data ?? [];
}

/* ----------------------------------------------------------------
   Come si scrive un periodo di tempo in italiano leggibile.
   ---------------------------------------------------------------- */

/** "40 giorni" diventa "1 mese e 10 giorni"? No: in reception serve
    sapere subito se è tanto o poco, e i giorni si capiscono al volo.
    Oltre il mese però il numero grande perde senso, e si arrotonda. */
export function daQuanto(giorni) {
  const g = Number(giorni) || 0;
  if (g < 7) return `${g} giorni`;
  if (g < 60) {
    const set = Math.floor(g / 7);
    return set === 1 ? "1 settimana" : `${set} settimane`;
  }
  const mesi = Math.round(g / 30);
  return `${mesi} mesi`;
}

/** Quanto manca a una scadenza, o quanto è passato se è già scaduta. */
export function fraQuanto(giorni) {
  const g = Number(giorni);
  if (!Number.isFinite(g)) return "";
  if (g < 0) return `scaduto da ${daQuanto(-g)}`;
  if (g === 0) return "scade oggi";
  if (g === 1) return "scade domani";
  return `fra ${daQuanto(g)}`;
}

/** La data come la si legge: 24 ott. */
const MESI = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

export function giornoCorto(iso) {
  if (!iso) return "";
  const [a, m, g] = String(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m || !g) return "";
  return `${g} ${MESI[m - 1]}`;
}

/* Il mese per esteso.

   Serve dove accanto si parla anche di settimane: "2 set" si legge
   benissimo come "2 settimane" invece che "2 settembre", e in una
   riga che dice pure "6 settimane fa" diventa un rebus. */
const MESI_INTERI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export function giornoIntero(iso) {
  if (!iso) return "";
  const [a, m, g] = String(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m || !g) return "";
  return `${g} ${MESI_INTERI[m - 1]}`;
}

/* ----------------------------------------------------------------
   Economia.

   Non è la contabilità e non deve diventarlo: è quanto portano
   abbonamenti e quote, che è la parte che l'app conosce davvero. I
   pagamenti non ci passano, quindi il valore è quello di listino, non
   il denaro entrato in cassa.
   ---------------------------------------------------------------- */

export async function economiaRiassunto() {
  const { data, error } = await supabase.rpc("economia_riassunto");
  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

export async function economiaPerMese(quantiMesi = 12) {
  const { data, error } = await supabase.rpc("economia_per_mese", {
    quanti_mesi: quantiMesi,
  });
  if (error) throw error;
  return data ?? [];
}

export async function economiaPerPacchetto(mesiIndietro = 12) {
  const { data, error } = await supabase.rpc("economia_per_pacchetto", {
    mesi_indietro: mesiIndietro,
  });
  if (error) throw error;
  return data ?? [];
}

/** Gli euro come si scrivono su un cartello: senza centesimi, con il
    punto delle migliaia. In reception i centesimi non servono, e
    occupano il posto che serve alla cifra. */
export function euro(n) {
  const v = Math.round(Number(n) || 0);
  return `${v.toLocaleString("it-IT")} €`;
}

/** "ott 26", per le colonne dei mesi. */
export function meseCorto(iso) {
  if (!iso) return "";
  const [a, m] = String(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m) return "";
  return `${MESI[m - 1]} ${String(a).slice(2)}`;
}
