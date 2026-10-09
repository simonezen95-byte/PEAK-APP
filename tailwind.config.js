/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // La scala dei neri, presa misurando il mockup. Il fondo è
      // quasi nero pieno: è quello che fa risaltare tutto il resto.
      colors: {
        fondo:   "#050507",   // la pagina
        scheda:  "#0D0E10",   // l'interno delle schede
        bordo:   "#232427",   // il bordo delle schede
        rilievo: "#161719",   // i cerchi delle icone
        filo:    "#1C1D20",   // divisori e righe fra le voci
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
