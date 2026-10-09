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
