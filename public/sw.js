/* Il service worker.

   È l'unico pezzo di PEAK che resta sveglio quando l'app è chiusa.
   Non vede lo schermo, non sa chi è entrato, non può chiedere niente
   a nessuno: sta lì e aspetta che arrivi un messaggio.

   Per questo è scritto corto e senza dipendenze. Un errore qui non
   dà uno schermo nero, dà una notifica che non arriva — che è peggio,
   perché non se ne accorge nessuno.

   Vive in public/ e non in src/ di proposito: deve stare nella
   radice del sito. Un service worker può ricevere solo per le pagine
   che stanno dentro la sua cartella, e messo altrove coprirebbe solo
   un pezzo dell'app. */

const ICONA = "/icona-192.png";
const BADGE = "/icona-maschera-512.png";

self.addEventListener("install", () => {
  // Niente attese: la versione nuova prende servizio subito, invece
  // di restare in coda finché il socio non chiude tutte le schede.
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (e) => {
  // Se il messaggio arriva vuoto o illeggibile si mostra comunque
  // qualcosa: una notifica generica è meglio del silenzio, perché
  // almeno la persona apre l'app e trova l'avviso nella campanella.
  let dati = {};
  try {
    dati = e.data ? e.data.json() : {};
  } catch {
    dati = {};
  }

  const titolo = dati.titolo || "PEAK";
  const opzioni = {
    body: dati.testo || "Hai un avviso nell'app.",
    icon: ICONA,
    badge: BADGE,
    lang: "it",
    // Notifiche sullo stesso argomento si sostituiscono invece di
    // impilarsi: se una lezione viene annullata e poi rimessa, il
    // socio deve trovare l'ultima cosa vera, non tutte e due.
    tag: dati.gruppo || "peak",
    renotify: true,
    data: { link: dati.link || "/" },
  };

  e.waitUntil(self.registration.showNotification(titolo, opzioni));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const dove = (e.notification.data && e.notification.data.link) || "/";

  // Se l'app è già aperta si porta in primo piano quella, invece di
  // aprirne una seconda copia.
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((finestre) => {
        for (const f of finestre) {
          if (f.url.includes(self.location.origin) && "focus" in f) {
            f.navigate(dove);
            return f.focus();
          }
        }
        return self.clients.openWindow(dove);
      })
  );
});
