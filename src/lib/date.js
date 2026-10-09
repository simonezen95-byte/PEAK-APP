/* Date e orari, scritti all'italiana.

   Il database parla in "2026-10-12". Costruire una data da quella
   stringa con new Date("2026-10-12") la interpreta come mezzanotte di
   Greenwich, e in Italia d'estate diventa il giorno prima. Qui le date
   si montano sempre pezzo per pezzo, così il giorno resta quello. */

const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const GIORNI_LUNGHI = [
  "domenica", "lunedì", "martedì", "mercoledì",
  "giovedì", "venerdì", "sabato",
];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** Da "2026-10-12" a un oggetto Date locale. */
export function aData(iso) {
  const [a, m, g] = String(iso).split("-").map(Number);
  return new Date(a, m - 1, g);
}

/** Da un oggetto Date a "2026-10-12". */
export function aIso(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function oggiIso() {
  return aIso(new Date());
}

/** Il lunedì della settimana in cui cade questa data. */
export function lunedi(iso) {
  const d = aData(iso);
  const scarto = (d.getDay() + 6) % 7;   // domenica = 6
  d.setDate(d.getDate() - scarto);
  return aIso(d);
}

export function piuGiorni(iso, n) {
  const d = aData(iso);
  d.setDate(d.getDate() + n);
  return aIso(d);
}

/** "lun" */
export function giornoCorto(iso) {
  return GIORNI[aData(iso).getDay()];
}

/** "12" */
export function numeroGiorno(iso) {
  return aData(iso).getDate();
}

/** "lunedì 12 ottobre" */
export function dataEstesa(iso) {
  const d = aData(iso);
  return `${GIORNI_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** "12 ott", e "12 ott 2027" se cade in un altro anno: una scadenza
    senza anno si legge come se fosse domani. */
export function dataBreve(iso) {
  const d = aData(iso);
  const anno = d.getFullYear() === new Date().getFullYear()
    ? ""
    : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}${anno}`;
}

/** "ottobre 2026", per l'intestazione della settimana. */
export function meseEAnno(iso) {
  const d = aData(iso);
  return `${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

/** Da "18:30:00" a "18:30". */
export function soloOra(ora) {
  return String(ora).slice(0, 5);
}

/** "18:30" + 60 minuti = "19:30". */
export function piuMinuti(ora, minuti) {
  const [h, m] = soloOra(ora).split(":").map(Number);
  const t = h * 60 + m + minuti;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 60) % 24)}:${p(t % 60)}`;
}

/** Quanti minuti mancano all'inizio. Negativo se è già cominciata. */
export function minutiAllInizio(iso, ora) {
  const d = aData(iso);
  const [h, m] = soloOra(ora).split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return Math.round((d.getTime() - Date.now()) / 60000);
}

export function eOggi(iso) {
  return iso === oggiIso();
}

/** "oggi", "domani", oppure "lunedì 12 ottobre". */
export function quando(iso) {
  if (eOggi(iso)) return "oggi";
  if (iso === piuGiorni(oggiIso(), 1)) return "domani";
  return dataEstesa(iso);
}
