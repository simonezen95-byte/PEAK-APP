/* Le notifiche sul telefono.

   Tre cose devono andare a posto perché arrivino, e sono in ordine:

   1. il browser deve saper ricevere notifiche (non tutti sanno);
   2. il socio deve dare il permesso, e glielo si può chiedere solo
      dopo che ha toccato qualcosa — non all'apertura dell'app;
   3. il telefono si iscrive e l'iscrizione va salvata nel database.

   Ogni passo può fallire da solo, e per ognuno serve una spiegazione
   diversa: "il tuo telefono non può" e "hai detto di no" sono due
   situazioni che si rimediano in due modi opposti.

   ------------------------------------------------------------
   IPHONE

   Su iPhone tutto questo esiste solo se l'app è stata aggiunta alla
   schermata Home e viene aperta da lì. In Safari come pagina normale
   non c'è proprio: non è un permesso negato, è che il browser non
   offre la funzione. Per questo la prima cosa che si controlla è se
   siamo dentro l'app installata, e in caso contrario si spiega cosa
   fare invece di mostrare un bottone che non funzionerebbe. */

import { supabase } from "./supabase";

/* La chiave pubblica con cui il server firma le notifiche.

   Sta scritta qui in chiaro perché è pubblica per definizione: serve
   al telefono per riconoscere che il messaggio arriva da noi. Quella
   privata, che firma davvero, non è in questo progetto e non deve
   finirci: vive solo nelle impostazioni di Vercel. */
const CHIAVE_PUBBLICA =
  "BHCyrjsk7ImHVvfjJ5VHfzhnKrpAsvcmYpepasFOKT2bi28CIiv3R3ujdbnbUEzrnnz5AQr0LUZPeiLad5uejHo";


/** L'app è aperta dall'icona sulla schermata Home, o è una pagina
    dentro al browser? Su iPhone cambia tutto. */
export function installata() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari su iPhone usa una sua bandierina, più vecchia dello
    // standard.
    window.navigator.standalone === true
  );
}

export function eIphone() {
  const s = navigator.userAgent || "";
  // Gli iPad recenti si presentano come computer: si riconoscono dal
  // fatto che hanno un touchscreen e il motore di Safari.
  return (
    /iPhone|iPad|iPod/.test(s) ||
    (/Macintosh/.test(s) && navigator.maxTouchPoints > 1)
  );
}

/** Il browser sa ricevere notifiche? */
export function supportate() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/* In che situazione siamo, in una parola sola.

   Le schermate non devono rifare questo ragionamento: chiedono qui e
   mostrano la frase giusta.

     "accese"      arrivano
     "spente"      si possono accendere
     "negate"      ha detto di no: si rimedia dalle impostazioni
     "da-casa"     iPhone, va aggiunta alla schermata Home
     "impossibile" questo browser non può, e non c'è rimedio */
export async function comeSiamo() {
  if (!supportate()) {
    return eIphone() && !installata() ? "da-casa" : "impossibile";
  }
  if (Notification.permission === "denied") return "negate";
  if (Notification.permission !== "granted") return "spente";

  const iscr = await iscrizioneAttuale();
  return iscr ? "accese" : "spente";
}


/* ----------------------------------------------------------------
   Il service worker
   ---------------------------------------------------------------- */

let registrazione = null;

async function registra() {
  if (registrazione) return registrazione;
  registrazione = await navigator.serviceWorker.register("/sw.js");
  // Aspetta che sia davvero in servizio: appena registrato non lo è
  // ancora, e iscriversi in quel momento fallisce in modo oscuro.
  await navigator.serviceWorker.ready;
  return registrazione;
}

async function iscrizioneAttuale() {
  if (!supportate()) return null;
  try {
    const r = await navigator.serviceWorker.getRegistration();
    if (!r) return null;
    return await r.pushManager.getSubscription();
  } catch {
    return null;
  }
}


/* ----------------------------------------------------------------
   Accendere e spegnere
   ---------------------------------------------------------------- */

/** La chiave pubblica va passata al browser come sequenza di byte,
    non come testo. */
function aByte(base64url) {
  const pieno = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const giusto = pieno.padEnd(pieno.length + ((4 - (pieno.length % 4)) % 4), "=");
  const grezzo = atob(giusto);
  return Uint8Array.from(grezzo, (c) => c.charCodeAt(0));
}

/** Le chiavi dell'iscrizione arrivano come byte e vanno salvate come
    testo. */
function aTesto(buffer) {
  if (!buffer) return "";
  const b = new Uint8Array(buffer);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

/** Accende le notifiche su QUESTO telefono.

    Va chiamata dentro un tocco: il permesso non si può chiedere da
    soli, e chiesto fuori da un gesto il browser lo rifiuta in
    silenzio. */
export async function accendi(comeSiChiama = null) {
  if (!supportate()) {
    throw new Error(
      eIphone() && !installata() ? "da-casa" : "impossibile"
    );
  }

  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("negate");

  const r = await registra();

  // Se c'è già un'iscrizione si riusa: chiederne una nuova sullo
  // stesso telefono ne lascerebbe in giro una morta, e il server
  // continuerebbe a spedire a un indirizzo che non ascolta più.
  let iscr = await r.pushManager.getSubscription();
  if (!iscr) {
    iscr = await r.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: aByte(CHIAVE_PUBBLICA),
    });
  }

  const dati = iscr.toJSON();
  const { error } = await supabase.rpc("salva_telefono", {
    indirizzo: iscr.endpoint,
    chiave_p256dh: dati.keys?.p256dh ?? aTesto(iscr.getKey?.("p256dh")),
    chiave_auth: dati.keys?.auth ?? aTesto(iscr.getKey?.("auth")),
    e_installata: installata(),
    come_si_chiama: comeSiChiama,
  });
  if (error) throw error;

  return true;
}

/** Spegne le notifiche su questo telefono.

    Si disfa l'iscrizione nel browser E si toglie dal database: una
    sola delle due lascerebbe il server a spedire nel vuoto, o il
    telefono a ricevere da un'iscrizione che l'app crede spenta. */
export async function spegni() {
  const iscr = await iscrizioneAttuale();
  if (!iscr) return;

  const indirizzo = iscr.endpoint;
  try {
    await iscr.unsubscribe();
  } catch {
    /* Se il browser non ci riesce si toglie comunque dal database:
       meglio una notifica persa che una che arriva a chi l'ha
       spenta. */
  }
  const { error } = await supabase.rpc("togli_telefono", { indirizzo });
  if (error) throw error;
}

/** Quanti soci hanno le notifiche accese. Per lo staff. */
export async function quantiRaggiungibili() {
  const { data, error } = await supabase.rpc("quanti_raggiungibili");
  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}
