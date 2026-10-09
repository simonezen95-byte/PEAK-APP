import { ChevronLeft } from "lucide-react";

/* Il numero di versione viene salvato insieme al consenso di ogni
   socio: serve a dimostrare quale testo ha accettato. Va alzato ogni
   volta che l'informativa cambia. */
export const VERSIONE_INFORMATIVA = "0.1-bozza";

/* ATTENZIONE: questo è un segnaposto, non un documento valido.
   Il testo definitivo lo redige il commercialista dell'ASD. Le parti
   fra parentesi quadre sono quelle ancora da compilare. */

export default function Informativa({ onIndietro }) {
  return (
    <div className="min-h-full px-6 py-8 max-w-sm mx-auto w-full">
      <button
        type="button"
        onClick={onIndietro}
        aria-label="Torna indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <h1 className="font-display font-bold text-[22px] text-neutral-50 mt-2">
        Informativa privacy
      </h1>
      <p className="text-[11px] text-neutral-500 mt-1.5">
        Versione {VERSIONE_INFORMATIVA}
      </p>

      <div className="mt-5 mb-6 border border-amber-400/30 bg-amber-400/10 rounded-xl px-3.5 py-3">
        <p className="text-[12px] text-amber-200/90 leading-relaxed">
          Testo provvisorio, in attesa della stesura definitiva. Prima
          dell'apertura va sostituito con l'informativa redatta dal
          commercialista dell'associazione.
        </p>
      </div>

      <div className="space-y-5 text-[12.5px] text-neutral-300 leading-relaxed pb-6">
        <Sezione titolo="Chi tratta i tuoi dati">
          PEAK Functional Fitness A.S.D., Via Enrico Mattei 18, 31010 Maser (TV),
          codice fiscale e partita IVA 05641970263. Per ogni richiesta:
          info.peakfunctionalfitness@gmail.com.
        </Sezione>

        <Sezione titolo="Quali dati raccogliamo">
          Nome, cognome, data di nascita, email e numero di telefono, forniti da
          te in fase di iscrizione. Foto profilo, se decidi di caricarla.
          Registriamo inoltre le tue prenotazioni, le presenze confermate dallo
          staff, i risultati degli allenamenti e i massimali che inserisci.
        </Sezione>

        <Sezione titolo="La scadenza del certificato medico">
          Conserviamo <strong className="text-neutral-100">solo la data di
          scadenza</strong> del tuo certificato di idoneità sportiva. È un dato
          relativo alla salute e lo trattiamo per l'obbligo di legge che impone
          di verificare l'idoneità prima dell'attività. Il documento cartaceo
          resta in reception e non viene caricato nell'app.
        </Sezione>

        <Sezione titolo="Perché li trattiamo">
          Per gestire il tuo tesseramento e l'abbonamento, permetterti di
          prenotare, tenere il registro delle presenze e adempiere agli obblighi
          fiscali e assicurativi dell'associazione.
        </Sezione>

        <Sezione titolo="Chi li può vedere">
          Lo staff della palestra. Gli altri soci vedono il tuo nome e la tua
          foto negli elenchi degli iscritti alle classi. I tuoi risultati e i
          tuoi massimali compaiono in classifica solo se scegli di condividerli:
          puoi cambiare idea in ogni momento dal tuo profilo.
        </Sezione>

        <Sezione titolo="Foto e video">
          La pubblicazione di foto e video che ti ritraggono sui canali della
          palestra avviene solo con il tuo consenso, che è facoltativo e puoi
          revocare quando vuoi senza conseguenze sull'iscrizione.
        </Sezione>

        <Sezione titolo="Per quanto tempo">
          [Da definire: periodo di conservazione dei dati dopo la cessazione
          dell'iscrizione, da coordinare con i termini fiscali e assicurativi.]
        </Sezione>

        <Sezione titolo="Dove sono conservati">
          Su server situati nell'Unione Europea.
        </Sezione>

        <Sezione titolo="I tuoi diritti">
          Puoi chiedere di accedere ai tuoi dati, correggerli, cancellarli,
          limitarne il trattamento od opporti. Scrivi a
          info.peakfunctionalfitness@gmail.com. Se ritieni che i tuoi dati siano
          trattati in modo scorretto puoi rivolgerti al Garante per la
          protezione dei dati personali.
        </Sezione>
      </div>
    </div>
  );
}

function Sezione({ titolo, children }) {
  return (
    <section>
      <h2 className="font-display font-bold text-[14px] text-neutral-50 mb-1.5">
        {titolo}
      </h2>
      <p>{children}</p>
    </section>
  );
}
