import React from "react";
import { createRoot } from "react-dom/client";
import { ProviderSessione } from "./lib/sessione";
import App from "./App";
import Tv from "./schermate/Tv";
import "./index.css";

/* Due vie d'ingresso.

   /tv/<codice> è lo schermo appeso in sala: niente accesso, niente
   sessione, nessuna attesa. Sta fuori dal resto apposta — se un
   giorno l'app avesse un problema di accesso, il WOD in sala deve
   comparire lo stesso.

   Tutto il resto è l'app. */

const percorso = window.location.pathname.replace(/\/+$/, "");
const tv = percorso.match(/^\/tv\/([A-Za-z0-9_-]+)$/);

/* Il service worker, registrato all'avvio.

   Serve per le notifiche, ma va messo in servizio prima che qualcuno
   le accenda: registrarlo solo al tocco del bottone vorrebbe dire
   aspettare l'installazione proprio nel momento in cui la persona sta
   guardando se succede qualcosa.

   Non si registra sullo schermo della TV: quello sta appeso in sala e
   non deve ricevere niente.

   Se fallisce non succede niente di grave — l'app funziona lo stesso,
   solo senza avvisi sul telefono — quindi l'errore resta nella
   console e non in faccia al socio. */
if (!tv && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("Service worker non registrato:", e);
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {tv ? (
      <Tv codice={tv[1]} />
    ) : (
      <ProviderSessione>
        <App />
      </ProviderSessione>
    )}
  </React.StrictMode>
);
