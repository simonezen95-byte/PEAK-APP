/* Ruoli e permessi.

   Le regole stanno già nel database e non si toccano da qui: è il
   database a dire che solo il titolare assegna ruoli, e che il
   titolare non può togliersi il proprio. Questo file serve a parlare
   di permessi in italiano invece che per sigle, e a scriverli.

   Come li legge il database, in quest'ordine:

     1. se il permesso è scritto nella scheda, vale quello — anche un
        "no" scritto a mano su un admin;
     2. altrimenti, se sei titolare o admin, sì;
     3. altrimenti, se sei coach, sì per le tre cose del coach;
     4. altrimenti no.

   Quindi scrivere un permesso serve a due cose opposte: darlo a un
   coach, o toglierlo a un admin. */

import { supabase } from "./supabase";

export const RUOLI = [
  {
    chiave: "socio",
    nome: "Socio",
    spiega: "Prenota, guarda il WOD, segna i propri risultati.",
  },
  {
    chiave: "coach",
    nome: "Coach",
    spiega: "In più: vede i soci, le classi, e conferma le presenze delle lezioni che tiene lui.",
  },
  {
    chiave: "admin",
    nome: "Admin",
    spiega: "Fa tutto quello che fai tu, tranne assegnare ruoli e permessi.",
  },
  {
    chiave: "owner",
    nome: "Titolare",
    spiega: "Tutto, compresi ruoli e permessi. Da dare solo a chi è titolare davvero.",
  },
];

/* I tredici permessi, raggruppati come li pensa chi li assegna.
   `coach` segna quelli che un coach ha già di suo: sugli altri la
   spunta aggiunge qualcosa, su quelli la toglie. */
export const PERMESSI = [
  {
    gruppo: "Soci",
    voci: [
      { chiave: "soci_view",    nome: "Vedere l'elenco dei soci", coach: true },
      { chiave: "soci_approve", nome: "Approvare e sospendere" },
      { chiave: "soci_edit",    nome: "Modificare le schede" },
    ],
  },
  {
    gruppo: "Abbonamenti",
    voci: [
      { chiave: "abb_view", nome: "Vedere abbonamenti e quote" },
      { chiave: "abb_edit", nome: "Registrare pagamenti e listino" },
    ],
  },
  {
    gruppo: "Classi",
    voci: [
      { chiave: "cl_view",       nome: "Vedere il calendario", coach: true },
      { chiave: "cl_attendance", nome: "Confermare le presenze", coach: true },
      { chiave: "cl_roster",     nome: "Iscrivere e togliere dalle classi" },
      { chiave: "cl_edit",       nome: "Annullare lezioni, capienza, coach" },
    ],
  },
  {
    gruppo: "WOD e comunicazioni",
    voci: [
      { chiave: "wod_write",  nome: "Scrivere il WOD" },
      { chiave: "wod_scores", nome: "Correggere i risultati altrui" },
      { chiave: "com_send",   nome: "Mandare comunicazioni" },
      { chiave: "com_board",  nome: "Gestire la bacheca" },
    ],
  },
];

/** Cosa vale oggi per questa persona, permesso per permesso: la
    stessa catena che segue il database. Serve a mostrare le spunte
    già al posto giusto invece che tutte vuote. */
export function valeOggi(socio, chiave, eDiCoach) {
  if (socio.stato !== "approvato") return false;
  if (socio.ruolo === "owner") return true;
  const scritti = socio.permessi ?? {};
  if (Object.prototype.hasOwnProperty.call(scritti, chiave)) {
    return scritti[chiave] === true;
  }
  if (socio.ruolo === "admin") return true;
  if (socio.ruolo === "coach") return Boolean(eDiCoach);
  return false;
}

/** Quello che il ruolo darebbe da solo, senza niente scritto a mano:
    serve a sapere se una spunta è un'eccezione o la normalità. */
export function daRuolo(ruolo, eDiCoach) {
  if (ruolo === "owner" || ruolo === "admin") return true;
  if (ruolo === "coach") return Boolean(eDiCoach);
  return false;
}

export function eOwner(profilo) {
  return profilo?.ruolo === "owner";
}

/** Un permesso qualsiasi, letto come lo legge il database: prima
    quello scritto a mano, poi quello che dà il ruolo. */
export function puo(profilo, chiave, eDiCoach = false) {
  if (!profilo) return false;
  return valeOggi(profilo, chiave, eDiCoach);
}

/* C'è qualcosa in "Altro", per questa persona?

   Un coach senza permessi in più ci troverebbe solo Progressi e
   Profilo: una voce della barra buttata via per arrivare al profilo
   con un tocco in più. In quel caso il quinto posto torna a essere
   il profilo, e "Altro" non compare proprio. */
export function haGestione(profilo) {
  return (
    eOwner(profilo) ||
    puo(profilo, "abb_edit") ||
    puo(profilo, "com_send") ||
    puo(profilo, "com_board")
  );
}

export async function cambiaRuolo(socioId, ruolo) {
  // Cambiando ruolo si azzerano i permessi scritti a mano: erano
  // eccezioni al ruolo di prima, e tenerle sul ruolo nuovo vorrebbe
  // dire portarsi dietro decisioni prese per un'altra persona.
  const { error } = await supabase
    .from("profili")
    .update({ ruolo, permessi: {} })
    .eq("id", socioId);
  if (error) throw error;
}

export async function cambiaPermessi(socioId, permessi) {
  const { error } = await supabase
    .from("profili")
    .update({ permessi })
    .eq("id", socioId);
  if (error) throw error;
}

/** I dati anagrafici. L'email resta fuori di proposito: quella di
    accesso è un'altra cosa, e cambiarla qui lascerebbe il socio a
    entrare con la vecchia senza che nessuno se ne accorga. */
export async function modificaSocio(socioId, dati) {
  const { error } = await supabase
    .from("profili")
    .update({
      nome: dati.nome.trim(),
      cognome: dati.cognome.trim(),
      telefono: dati.telefono.trim(),
      data_nascita: dati.data_nascita,
      comune: dati.comune?.trim() || null,
    })
    .eq("id", socioId);
  if (error) throw error;
}

export function spiega(e) {
  const t = String(e?.message || "");
  if (t.includes("Solo il titolare")) {
    return "Solo il titolare può assegnare ruoli e permessi.";
  }
  if (t.includes("non può togliersi")) {
    return "Non puoi toglierti il tuo ruolo di titolare.";
  }
  if (t.includes("row-level security")) {
    return "Non hai il permesso di modificare questa scheda.";
  }
  if (t.includes("reception")) return t;
  return "Non sono riuscito a salvare. Riprova.";
}
