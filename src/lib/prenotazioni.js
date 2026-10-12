/* Tutte le domande e le risposte fra l'app e il database in materia
   di prenotazioni. Le schermate chiamano queste funzioni e non
   scrivono mai query per conto loro: se un giorno cambia il database,
   si cambia qui e basta. */

import { supabase } from "./supabase";
import { minutiAllInizio } from "./date";

/** La settimana che comincia da questo lunedì: ogni lezione con i
    posti occupati e la tua prenotazione, se c'è. */
export async function settimana(dalIso) {
  const { data, error } = await supabase.rpc("settimana", { dal: dalIso });
  if (error) throw error;
  return data ?? [];
}

/** Certificato, quota associativa e abbonamento: le tre cose che
    decidono se puoi prenotare. */
export async function mioAccesso() {
  const { data, error } = await supabase.rpc("mio_accesso");
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Chi c'è dentro una lezione: prima i prenotati, poi la coda. */
export async function iscritti(sessioneId) {
  const { data, error } = await supabase
    .from("prenotazioni")
    .select("id, profilo_id, stato, posizione_coda")
    .eq("sessione_id", sessioneId)
    .in("stato", ["prenotato", "lista_attesa", "presente"])
    .order("posizione_coda", { ascending: true, nullsFirst: true })
    .order("prenotato_il", { ascending: true });
  if (error) throw error;

  const ids = (data ?? []).map((r) => r.profilo_id);
  if (ids.length === 0) return [];

  // I nomi degli altri soci passano dalla vista pubblica: dell'archivio
  // completo ognuno vede solo la propria riga.
  const { data: nomi, error: erroreNomi } = await supabase
    .from("soci_pubblici")
    .select("id, nome, cognome, foto_url")
    .in("id", ids);
  if (erroreNomi) throw erroreNomi;

  const perId = new Map((nomi ?? []).map((n) => [n.id, n]));
  return data.map((r) => ({
    ...r,
    socio: perId.get(r.profilo_id) ?? null,
  }));
}

/** Prenota. Se la classe è piena il database mette da solo in coda:
    la riga torna indietro con stato "lista_attesa". */
export async function prenota(sessioneId, profiloId) {
  const { data, error } = await supabase
    .from("prenotazioni")
    .insert({ sessione_id: sessioneId, profilo_id: profiloId })
    .select("stato, posizione_coda")
    .single();
  if (error) throw error;
  return data;
}

/** Disdici. Non cancello la riga: serve sapere che c'eri e che hai
    disdetto, e la disdetta è anche il momento in cui chi è primo in
    coda prende il tuo posto. */
export async function disdici(sessioneId, profiloId) {
  const { data, error } = await supabase
    .from("prenotazioni")
    .update({ stato: "disdetta", disdetta_il: new Date().toISOString() })
    .eq("sessione_id", sessioneId)
    .eq("profilo_id", profiloId)
    .in("stato", ["prenotato", "lista_attesa"])
    .select("id");
  if (error) throw error;

  // Oltre il quarto d'ora il database rifiuta la modifica, ma non la
  // segnala come errore: semplicemente non cambia niente. Senza questo
  // controllo l'app direbbe "disdetta" a vuoto.
  if (!data || data.length === 0) {
    const e = new Error("disdetta non consentita");
    e.tardi = true;
    throw e;
  }
}

/** Le tue prossime prenotazioni, per la schermata iniziale: con i
    posti ancora liberi e il nome del coach. */
export async function mieProssime(profiloId, quante = 5) {
  const oggi = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const iso = `${oggi.getFullYear()}-${p(oggi.getMonth() + 1)}-${p(oggi.getDate())}`;

  const { data, error } = await supabase
    .from("prenotazioni")
    .select(
      "id, stato, posizione_coda, sessioni!inner(id, data, ora, durata_min, tipo, nome, capienza, coach_id, annullata)"
    )
    .eq("profilo_id", profiloId)
    .in("stato", ["prenotato", "lista_attesa"])
    .gte("sessioni.data", iso)
    .order("data", { referencedTable: "sessioni", ascending: true })
    .order("ora", { referencedTable: "sessioni", ascending: true })
    // Ne chiedo qualcuna in più: quelle di stamattina, già finite,
    // le scarto qui sotto e non devono lasciare buchi.
    .limit(quante + 6);
  if (error) throw error;

  const righe = (data ?? [])
    .map((r) => ({
      stato: r.stato,
      posizione_coda: r.posizione_coda,
      ...r.sessioni,
    }))
    // Il filtro del database è per giorno: una classe delle 6:30 è
    // ancora "oggi" anche a mezzogiorno. Qui tolgo quelle finite,
    // lasciando però quella in corso: finché sei dentro, è la tua.
    .filter((r) => minutiAllInizio(r.data, r.ora) + (r.durata_min ?? 60) > 0)
    .slice(0, quante);

  if (righe.length === 0) return righe;

  // Quanti posti restano: il conteggio arriva con una lettura sola per
  // tutte le sessioni in elenco, non una per ciascuna.
  const idSessioni = righe.map((r) => r.id);
  const { data: altrui } = await supabase
    .from("prenotazioni")
    .select("sessione_id, stato")
    .in("sessione_id", idSessioni)
    .in("stato", ["prenotato", "presente"]);

  const occupati = new Map();
  for (const a of altrui ?? []) {
    occupati.set(a.sessione_id, (occupati.get(a.sessione_id) ?? 0) + 1);
  }

  // I nomi dei coach passano dalla vista pubblica, come ovunque.
  const idCoach = [...new Set(righe.map((r) => r.coach_id).filter(Boolean))];
  const nomi = new Map();
  if (idCoach.length) {
    const { data: persone } = await supabase
      .from("soci_pubblici")
      .select("id, nome, cognome")
      .in("id", idCoach);
    for (const c of persone ?? []) {
      nomi.set(c.id, `${c.nome} ${c.cognome}`.trim());
    }
  }

  return righe.map((r) => ({
    ...r,
    iscritti: occupati.get(r.id) ?? 0,
    posti_liberi: Math.max(0, r.capienza - (occupati.get(r.id) ?? 0)),
    coach: r.coach_id ? nomi.get(r.coach_id) ?? null : null,
  }));
}

/* ----------------------------------------------------------------
   Perché non posso prenotare.

   Il database risponde sì o no. Questa funzione traduce il no in una
   frase che dice cosa fare, perché "non puoi" da solo fa solo tornare
   il socio in reception a chiedere perché.
   ---------------------------------------------------------------- */

export function ostacoli(accesso, dataIso) {
  if (!accesso) return [];
  const lista = [];
  const giorno = dataIso ?? null;

  const scaduto = (data) => data && giorno && data < giorno;

  if (!accesso.certificato_scadenza) {
    lista.push({
      titolo: "Certificato medico mancante",
      testo: "Portalo in reception: senza non è possibile prenotare.",
    });
  } else if (scaduto(accesso.certificato_scadenza)) {
    lista.push({
      titolo: "Certificato medico scaduto",
      testo: "Portane uno nuovo in reception per tornare a prenotare.",
    });
  }

  if (!accesso.quota_fino || scaduto(accesso.quota_fino)) {
    lista.push({
      titolo: "Quota associativa da rinnovare",
      testo: "Si rinnova in reception a ogni stagione sportiva.",
    });
  }

  if (!accesso.abbonamento) {
    lista.push({
      titolo: "Nessun abbonamento attivo",
      testo: "Passa in reception per attivarlo.",
    });
  } else if (scaduto(accesso.abbonamento_fine)) {
    lista.push({
      titolo: "Abbonamento scaduto",
      testo: "Rinnovalo in reception per tornare a prenotare.",
    });
  } else if (accesso.residui === 0) {
    lista.push({
      titolo: "Ingressi esauriti",
      testo: "Il tuo pacchetto è finito: passa in reception.",
    });
  } else if (
    accesso.lezioni_settimana != null &&
    accesso.fatte_in_settimana >= accesso.lezioni_settimana
  ) {
    // Il tetto vale sulla settimana della lezione, non su quella di
    // oggi: da lunedì si riparte, e dirlo evita il giro in reception.
    lista.push({
      titolo: `Hai già le tue ${accesso.lezioni_settimana} di questa settimana`,
      testo: "Il tuo abbonamento ne apre "
        + `${accesso.lezioni_settimana} a settimana. Da lunedì si riparte, `
        + "e puoi già prenotare le lezioni della prossima.",
    });
  }

  return lista;
}

/** Come si scrive un abbonamento in una riga: "Mensile 2 a settimana ·
    2 a settimana", "Mensile 8 ingressi · 5 ingressi rimasti",
    "Mensile libero". */
export function dicitura(accesso) {
  if (!accesso?.abbonamento) return null;
  if (accesso.lezioni_settimana != null) {
    const restano = Math.max(
      0,
      accesso.lezioni_settimana - (accesso.fatte_in_settimana ?? 0)
    );
    return restano === 0
      ? "nessuna lezione questa settimana"
      : `${restano} ${restano === 1 ? "lezione" : "lezioni"} questa settimana`;
  }
  if (accesso.residui != null) {
    return `${accesso.residui} ${accesso.residui === 1 ? "ingresso" : "ingressi"}`;
  }
  return null;
}

/** Il caso particolare del pacchetto Open Box, che le classi non le apre. */
export function soloOpenBox(accesso) {
  return Boolean(accesso?.abbonamento) && accesso.include_classi === false;
}

/** I tre numeri della home, calcolati dal database: settimane di
    fila, allenamenti del mese e confronto col mese scorso. */
export async function mieStatistiche() {
  const { data, error } = await supabase.rpc("miei_allenamenti");
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Le ultime settimane, una per una: serve alle tacche sotto la
    fiamma della serie. L'ultima è quella in corso. */
export async function mieSettimane(quante = 8) {
  const { data, error } = await supabase.rpc("mie_settimane", { quante });
  if (error) throw error;
  return data ?? [];
}
