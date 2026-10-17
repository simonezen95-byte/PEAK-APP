/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // La scala dei neri, presa misurando il mockup. Il fondo è
      // quasi nero pieno: è quello che fa risaltare tutto il resto.
      colors: {
        fondo:   "#0A0A0A",   // la pagina
        scheda:  "#171717",   // l'interno delle schede
        bordo:   "#262626",   // il bordo delle schede
        rilievo: "#1F1F1F",   // i cerchi delle icone, le schede in allarme
        filo:    "#262626",   // divisori e righe fra le voci

        // ------------------------------------------------------
        // I GRIGI DEL TESTO
        //
        // Prima non c'erano: ogni schermata sceglieva a mano fra
        // text-neutral-400, 500, 600 e 700, e il risultato era che
        // 72 scritte su 156 non si leggevano abbastanza. Senza un
        // nome che dica a cosa serve un grigio, la scelta è un
        // gusto del momento ripetuto in venti file.
        //
        // Questi tre hanno un mestiere ciascuno, e tutti e tre
        // superano il minimo di legge (4.5:1) sia sulla pagina sia
        // dentro una scheda, che è un filo più chiara e quindi è il
        // caso peggiore. Il numero fra parentesi è il contrasto
        // misurato nella scheda.
        //
        // Dal 17 ottobre la scala è quella del sito (neri e grigi
        // Tailwind "neutral"), così app e sito sono lo stesso marchio.
        // Su quella scala "spento" non poteva restare più scuro: nelle
        // schede in allarme (fondo rilievo) scendeva sotto 4.5:1. Oggi
        // coincide con "dettaglio"; il nome resta perché dice il
        // mestiere, e se un giorno serve distinguerli si cambia qui.
        etichetta: "#A3A3A3",  // 7.1:1 — dice cos'è: nomi di sezione e di campo
        dettaglio: "#8A8A8A",  // 5.2:1 — la precisazione: date, unità, quanti
        spento:    "#8A8A8A",  // 5.2:1 — c'è ma non chiede attenzione
      },
      fontFamily: {
        // Barlow per titoli e numeri, Montserrat per il testo.
        display: ["Barlow", "sans-serif"],
        sans: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [],
};
