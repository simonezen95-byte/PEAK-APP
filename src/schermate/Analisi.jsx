import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft, Users, Activity, UserMinus, Sparkles, CalendarClock,
  UserRound, Phone, AlertTriangle, Stethoscope, FileText, CreditCard,
} from "lucide-react";
import {
  analisiSoci, sociFermi, scadenzeProssime,
  daQuanto, fraQuanto, giornoCorto, giornoIntero,
} from "../lib/analisi";
import { elencoSoci } from "../lib/staff";
import { Card, Vuoto, Scheletro, Avviso } from "../ui/base";

/* Analisi — lo stato dei soci.

   La home è la fotografia di oggi: quante classi, quanti prenotati.
   Questa è la stanza dove si scava, e parte dalle persone perché
   prima di aprire sono le persone che contano, non le tendenze: un
   grafico dell'andamento ha bisogno di mesi di dati per dire qualcosa
   di vero, mentre "chi non viene da un mese" è utile dal primo
   giorno.

   Ogni numero in testa è lì perché fa fare qualcosa. "Quanti soci in
   totale" non fa fare niente, e non c'è: al suo posto ci sono i tre
   gruppi in cui si dividono i soci, che sommati fanno il totale.

   Le due liste sotto sono due elenchi di telefonate: chi si è
   fermato, e a chi sta scadendo qualcosa. */

export default function Analisi({ onIndietro, onApriSocio }) {
  const [numeri, setNumeri] = useState(null);
  const [fermi, setFermi] = useState(null);
  const [scadenze, setScadenze] = useState(null);
  const [settimane, setSettimane] = useState(3);
  const [giorni, setGiorni] = useState(30);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    setErrore("");
    try {
      const [n, f, s] = await Promise.all([
        analisiSoci(settimane, giorni),
        sociFermi(settimane),
        scadenzeProssime(giorni),
      ]);
      setNumeri(n);
      setFermi(f);
      setScadenze(s);
    } catch {
      setErrore("Non riesco a leggere i dati.");
      setNumeri(null);
      setFermi([]);
      setScadenze([]);
    }
  }, [settimane, giorni]);

  useEffect(() => { carica(); }, [carica]);

  /* Toccando una riga si apre la scheda del socio.

     Le righe di queste liste sono un riassunto: non hanno il
     certificato, la quota, l'abbonamento. Se le passassimo così alla
     scheda, per un attimo si leggerebbe "certificato mancante" per
     uno che ce l'ha, e poi si correggerebbe da sola. Peggio di
     aspettare mezzo secondo. Quindi prima prendiamo la riga vera. */
  async function apriSocio(id, email) {
    if (!onApriSocio) return;
    try {
      const righe = await elencoSoci(email ?? "");
      const trovato = righe.find((x) => x.id === id);
      if (trovato) { onApriSocio(trovato); return; }
    } catch {
      /* Se la lettura non va, si apre comunque: la scheda si arrangia
         da sola a rileggere quello che le serve. */
    }
    const r =
      (fermi ?? []).find((x) => x.id === id) ??
      (scadenze ?? []).find((x) => x.profilo_id === id);
    onApriSocio({
      id,
      nome: r?.nome ?? "",
      cognome: r?.cognome ?? "",
      email: email ?? "",
      telefono: r?.telefono ?? "",
    });
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna indietro"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="mt-2 mb-6">
        <div className="text-[21px] font-display font-bold text-neutral-50 uppercase leading-tight">
          Stato dei soci
        </div>
        <div className="text-[11.5px] text-neutral-500 mt-1 leading-relaxed">
          Chi si allena, chi si è fermato, a chi sta scadendo qualcosa.
          Conta solo quello che il coach ha confermato: chi prenota e
          non si presenta non risulta allenato.
        </div>
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {!numeri && !errore ? (
        <Scheletro righe={3} />
      ) : (
        <>
          {numeri && (
            <Riquadri n={numeri} settimane={settimane} giorni={giorni} />
          )}

          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[11px] tracking-[0.15em] text-neutral-400 font-semibold">
                CHI SI È FERMATO
              </div>
              <Scelte
                valore={settimane}
                opzioni={[
                  { v: 2, nome: "2 set" },
                  { v: 3, nome: "3 set" },
                  { v: 6, nome: "6 set" },
                ]}
                onCambia={setSettimane}
              />
            </div>

            {fermi === null ? (
              <Scheletro righe={2} />
            ) : fermi.length === 0 ? (
              <Vuoto>
                Nessuno fermo da più di {daQuanto(settimane * 7)}.
                <br />Buon segno.
              </Vuoto>
            ) : (
              <div className="flex flex-col gap-2">
                {fermi.map((r) => (
                  <RigaFermo key={r.id} r={r} onApri={apriSocio} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[11px] tracking-[0.15em] text-neutral-400 font-semibold">
                COSA STA SCADENDO
              </div>
              <Scelte
                valore={giorni}
                opzioni={[
                  { v: 15, nome: "15 gg" },
                  { v: 30, nome: "30 gg" },
                  { v: 90, nome: "90 gg" },
                ]}
                onCambia={setGiorni}
              />
            </div>

            {scadenze === null ? (
              <Scheletro righe={2} />
            ) : scadenze.length === 0 ? (
              <Vuoto>Niente in scadenza nei prossimi {giorni} giorni.</Vuoto>
            ) : (
              <div className="flex flex-col gap-2">
                {scadenze.map((r, i) => (
                  <RigaScadenza
                    key={`${r.profilo_id}-${r.genere}-${r.quando}-${i}`}
                    r={r}
                    onApri={apriSocio}
                  />
                ))}
              </div>
            )}
            <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
              Compreso quello scaduto nelle ultime due settimane: è lì
              che serve guardare, perché è ancora recuperabile.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   I numeri in testa.

   Tre riquadri grandi per i gruppi che fanno il totale, e sotto una
   riga di numeri più piccoli per il resto. La differenza di misura
   dice cosa guardare prima: tre cose, non sette.
   ---------------------------------------------------------------- */

function Riquadri({ n, settimane, giorni }) {
  const soci = Number(n.soci) || 0;
  const q = (x) => (soci > 0 ? Math.round((Number(x) || 0) * 100 / soci) : 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Grosso
          icona={Activity}
          valore={n.attivi}
          nome="ATTIVI"
          nota={`${q(n.attivi)}%`}
        />
        <Grosso
          icona={UserMinus}
          valore={n.fermi}
          nome="FERMI"
          nota={`${q(n.fermi)}%`}
          allarme={Number(n.fermi) > 0}
        />
        <Grosso
          icona={Sparkles}
          valore={n.appena_arrivati}
          nome="NUOVI"
          nota={`${q(n.appena_arrivati)}%`}
        />
      </div>

      <div className="text-[10.5px] text-neutral-600 mt-2.5 leading-relaxed">
        I tre gruppi fanno i {soci} {soci === 1 ? "socio" : "soci"}{" "}
        approvati, e ognuno sta in uno solo: attivo chi si è allenato
        nelle ultime {settimane}{" "}
        {settimane === 1 ? "settimana" : "settimane"}, nuovo chi si è
        iscritto da meno e non è ancora venuto. Io e i coach non siamo
        contati.
      </div>

      <Card className="mt-4 !p-0 flex items-stretch divide-x divide-rilievo">
        <Piccolo icona={Users} valore={n.soci} nome="SOCI" />
        <Piccolo
          icona={CalendarClock}
          valore={n.scadenze}
          nome={`SCADENZE ${giorni} GG`}
        />
        <Piccolo
          icona={UserRound}
          valore={n.prove_del_mese}
          nome="PROVE DEL MESE"
        />
      </Card>
    </>
  );
}

function Grosso({ icona: Icona, valore, nome, nota, allarme }) {
  return (
    <div
      className={`rounded-2xl border p-3 flex flex-col items-center text-center ${
        allarme ? "border-neutral-600 bg-rilievo" : "border-bordo bg-scheda"
      }`}
    >
      <Icona size={15} className="text-neutral-400 mb-2" strokeWidth={1.8} />
      <div className="text-[24px] font-display font-bold text-neutral-50 leading-none">
        {valore ?? 0}
      </div>
      <div className="text-[8.5px] tracking-[0.1em] text-neutral-500 mt-2 font-semibold leading-tight">
        {nome}
      </div>
      {nota && <div className="text-[9px] text-neutral-600 mt-1">{nota}</div>}
    </div>
  );
}

function Piccolo({ icona: Icona, valore, nome }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center py-3.5 px-1">
      <Icona size={14} className="text-neutral-500 mb-1.5" strokeWidth={1.8} />
      <div className="text-[17px] font-display font-bold text-neutral-100 leading-none">
        {valore ?? 0}
      </div>
      <div className="text-[8px] tracking-[0.1em] text-neutral-600 mt-1.5 font-semibold leading-tight">
        {nome}
      </div>
    </div>
  );
}

/** I bottoncini per allargare o stringere la finestra. */
function Scelte({ valore, opzioni, onCambia }) {
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

/* ----------------------------------------------------------------
   Le righe delle due liste.
   ---------------------------------------------------------------- */

function RigaFermo({ r, onApri }) {
  return (
    <button
      onClick={() => onApri?.(r.id, r.email)}
      className="w-full rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3 text-left"
    >
      <Faccia r={r} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-neutral-100 truncate">
          {r.nome} {r.cognome}
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

function Faccia({ r }) {
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

function RigaScadenza({ r, onApri }) {
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
