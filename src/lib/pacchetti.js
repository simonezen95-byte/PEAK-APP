/* Il listino: leggerlo, scriverlo, e tradurlo fra come lo pensa il
   titolare e come lo tiene il database.

   Il database ha quattro colonne separate — ingressi,
   lezioni_settimana, include_classi, sessioni — e una loro
   combinazione qualsiasi sarebbe accettata anche se non ha senso (un
   pacchetto a ingressi che però non apre le classi, per dire). Qui si
   ragiona invece per FORME: un pacchetto è illimitato, oppure a
   ingressi, oppure a settimana, oppure solo Open Box. Una sola. Le
   colonne si riempiono di conseguenza, e le combinazioni senza senso
   non si possono nemmeno scrivere. */

import { supabase } from "./supabase";

export const FORME = [
  {
    chiave: "illimitato",
    nome: "Illimitato",
    spiega: "Entra quando vuole, nessun conteggio.",
  },
  {
    chiave: "ingressi",
    nome: "A ingressi",
    spiega: "Un pacchetto che finisce: 8 lezioni, 12 lezioni.",
    numero: "Quanti ingressi",
  },
  {
    chiave: "settimana",
    nome: "A settimana",
    spiega: "Un tetto che si azzera ogni lunedì. Quelle non usate non si accumulano.",
    numero: "Quante lezioni a settimana",
  },
  {
    chiave: "openbox",
    nome: "Solo Open Box",
    spiega: "Apre la sala libera, non le classi.",
  },
];

/** Dalla riga del database alla forma. L'ordine conta: un pacchetto
    che non apre le classi è Open Box qualunque altra cosa ci sia
    scritto sopra. */
export function formaDi(p) {
  if (!p.include_classi) return "openbox";
  if (p.lezioni_settimana != null) return "settimana";
  if (p.ingressi != null) return "ingressi";
  return "illimitato";
}

/** Dalla forma alle colonne. Quelle che non c'entrano restano vuote:
    è così che un pacchetto resta di una forma sola. */
export function colonneDi(forma, numero) {
  switch (forma) {
    case "ingressi":
      return { include_classi: true, ingressi: numero, lezioni_settimana: null };
    case "settimana":
      return { include_classi: true, ingressi: null, lezioni_settimana: numero };
    case "openbox":
      return { include_classi: false, ingressi: null, lezioni_settimana: null };
    default:
      return { include_classi: true, ingressi: null, lezioni_settimana: null };
  }
}

/** Come si legge un pacchetto in una riga. */
export function descrizione(p) {
  if (p.tipo === "personal") {
    return `${p.sessioni ?? 1} ${p.sessioni === 1 ? "sessione" : "sessioni"}`;
  }
  switch (formaDi(p)) {
    case "ingressi":   return `${p.ingressi} ingressi`;
    case "settimana":  return `${p.lezioni_settimana} a settimana`;
    case "openbox":    return "solo Open Box";
    default:           return "illimitato";
  }
}

export function durata(p) {
  return p.mesi === 1 ? "1 mese" : `${p.mesi} mesi`;
}

/** Tutto il listino, attivi e non. La reception vede solo gli attivi
    quando registra un abbonamento; qui servono anche gli altri,
    perché è qui che si riaccendono. */
export async function listino() {
  const { data, error } = await supabase
    .from("pacchetti")
    .select("id, nome, tipo, prezzo, mesi, ingressi, lezioni_settimana, include_classi, sessioni, attivo")
    .order("attivo", { ascending: false })
    .order("tipo")
    .order("prezzo");
  if (error) throw error;
  return data ?? [];
}

export async function creaPacchetto(p) {
  const { error } = await supabase.from("pacchetti").insert(p);
  if (error) throw error;
}

export async function modificaPacchetto(id, p) {
  const { error } = await supabase.from("pacchetti").update(p).eq("id", id);
  if (error) throw error;
}

/* Un pacchetto non si cancella: si spegne.

   Gli abbonamenti già venduti puntano al pacchetto, e cancellarlo
   vorrebbe dire perdere il nome di cosa ha comprato un socio l'anno
   scorso. Spento vuol dire che non si vende più, non che non è mai
   esistito. */
export async function spegniPacchetto(id, attivo) {
  const { error } = await supabase
    .from("pacchetti")
    .update({ attivo })
    .eq("id", id);
  if (error) throw error;
}

/** Quanti abbonamenti attivi dipendono da questo pacchetto: serve a
    dire al titolare cosa sta toccando prima che lo tocchi. */
export async function quantiInUso(pacchettoId) {
  const oggi = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from("abbonamenti")
    .select("id", { count: "exact", head: true })
    .eq("pacchetto_id", pacchettoId)
    .lte("inizio", oggi)
    .gte("fine", oggi);
  if (error) return 0;
  return count ?? 0;
}

export function puoGestireListino(profilo) {
  if (!profilo) return false;
  if (profilo.ruolo === "owner" || profilo.ruolo === "admin") return true;
  return profilo.permessi?.abb_edit === true;
}
