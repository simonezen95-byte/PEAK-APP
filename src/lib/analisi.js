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

export async function economiaPerPacchetto(giorni = 365) {
  const { data, error } = await supabase.rpc("economia_per_pacchetto", {
    giorni,
  });
  if (error) throw error;
  return data ?? [];
}

/* I colori delle fette.

   Sei colori per un grafico a torta sono più di quanti se ne possano
   distinguere con sicurezza: due di questi, per chi ha una comune
   alterazione della visione dei colori, arrivano quasi identici. Non
   è un dettaglio che si risolve scegliendo colori migliori — li ho
   cercati tutti, e non ce ne sono.

   Si regge su altre tre cose, che valgono anche senza vedere i
   colori: la percentuale scritta dentro la fetta, la percentuale
   nella legenda, e l'ordine. Le fette sono disegnate dalla più grande
   alla più piccola in senso orario, e la legenda segue lo stesso
   ordine: la terza voce della legenda è la terza fetta, e si trova
   contando, non riconoscendo un colore.

   I sei valori vengono da una tavolozza verificata per il fondo scuro
   di PEAK: stanno tutti nella stessa fascia di luminosità (nessuno
   sembra più importante) e staccano abbastanza dallo sfondo. */
export const COLORI_FETTE = [
  "#3987e5", // blu
  "#d95926", // arancio
  "#199e70", // verde acqua
  "#c98500", // giallo
  "#d55181", // magenta
  "#9085e9", // violetto
];

/** Il grigio del raggruppamento "Altri": non è una categoria, è il
    resto, e un colore pieno lo farebbe sembrare un pacchetto. */
export const COLORE_ALTRI = "#52525b";

/* Da un elenco di pacchetti alle fette del grafico.

   Oltre la sesta fetta il grafico smette di dire qualcosa: si
   tengono le prime cinque e tutto il resto diventa "Altri". Chi vuole
   il dettaglio ce l'ha nell'elenco sotto, completo. */
export function fette(righe, quante = 5) {
  const vivi = (righe ?? []).filter((r) => Number(r.venduti) > 0);
  const totale = vivi.reduce((s, r) => s + Number(r.venduti), 0);
  if (totale === 0) return { totale: 0, pezzi: [] };

  const teste = vivi.slice(0, quante);
  const coda = vivi.slice(quante);
  const pezzi = teste.map((r, i) => ({
    nome: r.pacchetto,
    quanti: Number(r.venduti),
    valore: Number(r.valore),
    quota: Number(r.venduti) / totale,
    colore: COLORI_FETTE[i],
  }));

  if (coda.length > 0) {
    const q = coda.reduce((s, r) => s + Number(r.venduti), 0);
    pezzi.push({
      // Senza il numero: nella legenda il conteggio sta già nella
      // colonna accanto, e "Altri 2" di fianco a un 2 si legge come
      // se il nome del pacchetto fosse "Altri 2".
      nome: coda.length === 1 ? coda[0].pacchetto : "Altri",
      quanti: q,
      valore: coda.reduce((s, r) => s + Number(r.valore), 0),
      quota: q / totale,
      colore: COLORE_ALTRI,
      resto: coda.length > 1,
    });
  }
  return { totale, pezzi };
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
