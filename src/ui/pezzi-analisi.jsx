import { useState } from "react";
import {
  ChevronLeft, Phone, AlertTriangle, Stethoscope, FileText,
  CreditCard, CalendarClock, Info,
} from "lucide-react";
import { daQuanto, fraQuanto, giornoCorto, giornoIntero } from "../lib/analisi";
import { elencoSoci } from "../lib/staff";

/* I pezzi che tutte le schermate dell'analisi usano uguali.

   Stanno qui e non dentro una schermata perché da quando l'analisi è
   diventata un indice con dentro più analisi, la stessa riga serve in
   più posti. Copiarla vorrebbe dire cambiarla in un posto solo la
   prossima volta, e ritrovarsi due liste che si somigliano ma non
   abbastanza. */


/* La "i" che apre una nota.

   Le spiegazioni di come è calcolato un numero servono, ma scritte
   sotto a ogni riquadro occupavano più spazio dei numeri stessi.
   Stanno qui dietro: chi se lo chiede preme, gli altri leggono i
   numeri.

   Quello che NON va qui è l'avvertenza che cambia come si legge il
   dato — "non sostituisce la contabilità". Una nota che bisogna
   aprire è una nota che non legge nessuno, e quella deve leggerla
   chiunque guardi la schermata. */
export function usaSpiegazione(testo, misura = 13) {
  const [aperta, setAperta] = useState(false);
  if (!testo) return { bottone: null, pannello: null };

  const bottone = (
    <button
      onClick={() => setAperta((v) => !v)}
      aria-expanded={aperta}
      aria-label={aperta ? "Nascondi la spiegazione" : "Come si legge questo dato"}
      className={`w-6 h-6 -my-1 flex items-center justify-center shrink-0 ${
        aperta ? "text-neutral-300" : "text-neutral-600"
      }`}
    >
      <Info size={misura} strokeWidth={2} />
    </button>
  );

  const pannello = aperta ? (
    <div className="text-[10.5px] text-neutral-500 leading-relaxed mt-2.5 border-l border-filo pl-3">
      {testo}
    </div>
  ) : null;

  return { bottone, pannello };
}


/** L'intestazione: freccia indietro, titolo, e una riga che dice cosa
    si sta guardando. Senza quella riga un numero resta un numero. */
export function Testata({ titolo, spiega, nota, onIndietro }) {
  // Bottone accanto al titolo, pannello in fondo: messo subito sotto
  // il titolo si infilava fra il titolo e la riga che dice cosa si
  // sta guardando, spezzandola in due.
  const { bottone, pannello } = usaSpiegazione(nota, 14);

  return (
    <>
      <button
        onClick={onIndietro}
        aria-label="Torna indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="mt-2 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[21px] font-display font-bold text-neutral-50 uppercase leading-tight">
            {titolo}
          </div>
          {bottone}
        </div>
        {spiega && (
          <div className="text-[11.5px] text-neutral-500 mt-1 leading-relaxed">
            {spiega}
          </div>
        )}
        {pannello}
      </div>
    </>
  );
}


/** I bottoncini per allargare o stringere la finestra di tempo. */
export function Scelte({ valore, opzioni, onCambia }) {
  return (
    <div className="flex items-center gap-1">
      {opzioni.map((o) => (
        <button
          key={o.v}
          onClick={() => onCambia(o.v)}
          className={`text-[10px] font-semibold tracking-wider px-2 py-1 rounded-full ${
            o.v === valore
              ? "bg-neutral-100 text-black"
              : "text-neutral-600 border border-filo"
          }`}
        >
          {o.nome.toUpperCase()}
        </button>
      ))}
    </div>
  );
}


/** Il titolo di una lista: a sinistra il nome e la "i", a destra i
    bottoncini della finestra di tempo. */
export function TitoloLista({ children, scelte, nota }) {
  const { bottone, pannello } = usaSpiegazione(nota);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="text-[11px] tracking-[0.15em] text-neutral-400 font-semibold">
            {children}
          </div>
          {bottone}
        </div>
        {scelte}
      </div>
      {pannello}
    </div>
  );
}


/* ----------------------------------------------------------------
   Aprire la scheda di un socio da una riga dell'analisi.

   Le righe di queste liste sono un riassunto: non hanno il
   certificato, la quota, l'abbonamento. Se le passassimo così alla
   scheda, per un attimo si leggerebbe "certificato mancante" per uno
   che ce l'ha, e poi si correggerebbe da sola. Peggio di aspettare
   mezzo secondo: quindi prima si prende la riga vera.
   ---------------------------------------------------------------- */

export function fabbricaApriSocio(onApriSocio, righe) {
  return async function apriSocio(id, email) {
    if (!onApriSocio) return;
    try {
      const elenco = await elencoSoci(email ?? "");
      const trovato = elenco.find((x) => x.id === id);
      if (trovato) { onApriSocio(trovato); return; }
    } catch {
      /* Se la lettura non va si apre comunque: la scheda si arrangia
         da sola a rileggere quello che le serve. */
    }
    const r = (righe ?? []).find((x) => (x.id ?? x.profilo_id) === id);
    onApriSocio({
      id,
      nome: r?.nome ?? "",
      cognome: r?.cognome ?? "",
      email: email ?? "",
      telefono: r?.telefono ?? "",
    });
  };
}


/* ----------------------------------------------------------------
   Le righe delle liste.
   ---------------------------------------------------------------- */

export function RigaFermo({ r, onApri }) {
  return (
    <button
      onClick={() => onApri?.(r.id, r.email)}
      className="w-full rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3 text-left"
    >
      <Faccia r={r} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-neutral-100 truncate flex items-center gap-2">
          <span className="truncate">{r.nome} {r.cognome}</span>
          {/* Lo staff è in lista perché si allena come gli altri, ma
              non è gente da richiamare: marcato, e messo in fondo dal
              database. */}
          {r.staff && (
            <span className="text-[8.5px] tracking-[0.1em] text-neutral-600 border border-filo rounded-full px-1.5 py-0.5 font-semibold shrink-0">
              STAFF
            </span>
          )}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
          {r.mai_venuto
            ? `Mai in classe — iscrizione ${daQuanto(r.giorni_fermo)} fa`
            : `Ultima volta ${daQuanto(r.giorni_fermo)} fa, il ${giornoIntero(r.ultima)}`}
        </div>
        {/* Il caso che brucia: i soldi sono entrati e la persona non
            si vede. È qui che una telefonata recupera ancora
            qualcosa, e per questo è scritto e non solo ordinato. */}
        {r.paga_e_non_viene && (
          <div className="text-[10.5px] text-neutral-300 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={11} strokeWidth={2} className="shrink-0" />
            Abbonamento attivo fino al {giornoCorto(r.abbonamento_fine)}
          </div>
        )}
      </div>
      {r.telefono && (
        <Phone size={14} className="text-neutral-700 shrink-0" strokeWidth={1.8} />
      )}
    </button>
  );
}


export function Faccia({ r }) {
  if (r.foto_url) {
    return (
      <img
        src={r.foto_url}
        alt=""
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-display font-bold text-neutral-400">
        {(r.nome?.[0] ?? "") + (r.cognome?.[0] ?? "")}
      </span>
    </div>
  );
}


const SEGNI = {
  certificato: Stethoscope,
  quota: FileText,
  abbonamento: CreditCard,
};

export function RigaScadenza({ r, onApri }) {
  const Icona = SEGNI[r.genere] ?? CalendarClock;
  return (
    <button
      onClick={() => onApri?.(r.profilo_id, r.email)}
      className={`w-full rounded-2xl border p-3.5 flex items-center gap-3 text-left ${
        r.scaduta ? "border-neutral-600 bg-rilievo" : "border-bordo bg-scheda"
      }`}
    >
      <div className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
        <Icona size={15} className="text-neutral-400" strokeWidth={1.7} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-neutral-100 truncate">
          {r.nome} {r.cognome}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
          {r.cosa}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`text-[11px] ${
            r.scaduta ? "text-neutral-200 font-semibold" : "text-neutral-400"
          }`}
        >
          {giornoCorto(r.quando)}
        </div>
        <div className="text-[9.5px] text-neutral-600 mt-0.5">
          {fraQuanto(r.giorni_a)}
        </div>
      </div>
    </button>
  );
}
