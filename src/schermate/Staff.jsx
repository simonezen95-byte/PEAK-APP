import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserPlus, UserMinus } from "lucide-react";
import { elencoSoci, schedaSocio } from "../lib/staff";
import { RUOLI, PERMESSI, valeOggi, daRuolo, cambiaRuolo, spiega } from "../lib/ruoli";
import RuoloEPermessi from "../ui/RuoloEPermessi";
import { Titolo, Avviso, Vuoto, Card } from "../ui/base";

/* Chi gestisce il box, e cosa può fare.

   Come da decisioni: la vede solo il titolare, e per gli altri la
   voce non esiste proprio. Non c'è nessun "aggiungi staff" che crea
   account: si promuove un socio già registrato e approvato, cercandolo
   per nome. Chi è nello staff resta socio a tutti gli effetti —
   prenota, compare negli iscritti, ha i suoi progressi.

   Nell'elenco il titolare compare come gli altri, senza distintivo:
   la differenza si vede solo da qui dentro, che gli altri non hanno. */

export default function Staff({ profilo, onIndietro, onMessaggio }) {
  const [righe, setRighe] = useState(null);
  const [apre, setApre] = useState(null);
  const [cerca, setCerca] = useState(false);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    try {
      const tutti = await elencoSoci("");
      const staff = tutti.filter((r) => r.ruolo !== "socio");
      // Le schede complete servono per i permessi: l'elenco non li
      // porta, e senza si vedrebbero tutte le spunte sbagliate.
      // Se una scheda non torna si tiene la riga dell'elenco: meglio
      // mostrarla senza i permessi che far sparire una persona dallo
      // staff, o rompere la schermata su una riga vuota.
      const complete = await Promise.all(
        staff.map((r) =>
          schedaSocio(r.id).then((x) => ({ ...r, ...(x ?? {}) })).catch(() => r)
        )
      );
      setRighe(complete.filter(Boolean));
    } catch {
      setErrore("Non riesco a leggere l'elenco dello staff.");
      setRighe([]);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  async function promuovi(socio, ruolo) {
    setErrore("");
    try {
      await cambiaRuolo(socio.id, ruolo);
      onMessaggio(`${socio.nome} ${socio.cognome} adesso è ${ruolo}.`);
      setCerca(false);
      await carica();
    } catch (e) {
      setErrore(spiega(e));
    }
  }

  async function rimuovi(s) {
    setErrore("");
    try {
      await cambiaRuolo(s.id, "socio");
      onMessaggio(`${s.nome} è tornato socio.`);
      setApre(null);
      await carica();
    } catch (e) {
      setErrore(spiega(e));
    }
  }

  if (cerca) {
    return (
      <Promuovi
        gia={new Set((righe ?? []).map((r) => r.id))}
        onScelto={promuovi}
        onIndietro={() => setCerca(false)}
      />
    );
  }

  if (apre) {
    return (
      <Scheda
        s={apre}
        io={apre.id === profilo.id}
        onIndietro={() => { setApre(null); carica(); }}
        onCambiato={(patch) => setApre((v) => ({ ...v, ...patch }))}
        onRimuovi={() => rimuovi(apre)}
        onMessaggio={onMessaggio}
      />
    );
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
          Staff
        </div>
        <div className="text-[11.5px] text-dettaglio mt-1 leading-relaxed">
          Chi gestisce il box. Questa schermata la vedi solo tu.
        </div>
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {righe === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-scheda animate-pulse" />
          ))}
        </div>
      ) : righe.length === 0 ? (
        <Vuoto>Nessuno nello staff, a parte te.</Vuoto>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {righe.map((s) => (
            <Riga key={s.id} s={s} io={s.id === profilo.id} onApri={() => setApre(s)} />
          ))}
        </div>
      )}

      <button
        onClick={() => setCerca(true)}
        className="w-full rounded-2xl border border-dashed border-bordo p-3.5 flex items-center justify-center gap-2.5 text-etichetta"
      >
        <UserPlus size={15} strokeWidth={1.8} />
        <span className="text-[12.5px] font-semibold">Metti un socio nello staff</span>
      </button>

      <div className="text-[11px] text-spento leading-relaxed mt-4">
        Si promuove un socio già registrato e approvato: da qui non si
        creano account. Chi entra nello staff resta socio come prima —
        prenota, compare negli iscritti, tiene i suoi progressi.
      </div>
    </div>
  );
}

function quante(s) {
  let n = 0;
  for (const g of PERMESSI) {
    for (const v of g.voci) {
      if (valeOggi(s, v.chiave, v.coach) !== daRuolo(s.ruolo, v.coach)) n++;
    }
  }
  return n;
}

function Riga({ s, io, onApri }) {
  const ruolo = RUOLI.find((x) => x.chiave === s.ruolo);
  const eccezioni = quante(s);
  return (
    <button
      onClick={onApri}
      className="rounded-2xl border border-bordo bg-scheda p-3.5 flex items-center gap-3 text-left"
    >
      <div className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
        <span className="text-[10.5px] font-display font-bold text-etichetta">
          {`${s.nome?.[0] ?? ""}${s.cognome?.[0] ?? ""}`.toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-neutral-100 truncate">
          {s.cognome} {s.nome}
          {io && <span className="text-spento"> · tu</span>}
        </div>
        <div className="text-[10.5px] text-dettaglio mt-0.5 truncate">
          {ruolo?.nome ?? s.ruolo}
          {eccezioni > 0 &&
            ` · ${eccezioni} ${eccezioni === 1 ? "eccezione" : "eccezioni"}`}
        </div>
      </div>
      <ChevronRight size={16} className="text-spento shrink-0" />
    </button>
  );
}

/* La scheda di chi è nello staff. Sul proprio profilo ruolo e
   permessi non si toccano: è la regola che impedisce al titolare di
   chiudersi fuori dalla gestione, e la scrive anche il database. */
function Scheda({ s, io, onIndietro, onCambiato, onRimuovi, onMessaggio }) {
  const [conferma, setConferma] = useState(false);

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna allo staff"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="flex items-center gap-4 mt-2 mb-6">
        <div className="w-14 h-14 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
          <span className="text-[16px] font-display font-bold text-etichetta">
            {`${s.nome?.[0] ?? ""}${s.cognome?.[0] ?? ""}`.toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[20px] font-display font-bold text-neutral-50 leading-tight truncate">
            {s.nome} {s.cognome}
          </div>
          <div className="text-[11.5px] text-dettaglio mt-0.5 truncate">{s.email}</div>
        </div>
      </div>

      {io ? (
        <Card className="mb-6">
          <div className="text-[12.5px] text-etichetta leading-relaxed">
            Questo sei tu. Ruolo e permessi non si modificano da qui, per
            non rischiare di chiuderti fuori dalla gestione.
          </div>
        </Card>
      ) : (
        <>
          <RuoloEPermessi s={s} onCambiato={onCambiato} onMessaggio={onMessaggio} />

          {!conferma ? (
            <button
              onClick={() => setConferma(true)}
              className="w-full rounded-xl border border-bordo text-dettaglio py-3 text-[12px] font-semibold flex items-center justify-center gap-2"
            >
              <UserMinus size={14} />
              TOGLI DALLO STAFF
            </button>
          ) : (
            <div>
              <div className="mb-3">
                <Avviso tono="nota">
                  {s.nome} <strong>torna socio</strong>: tiene l'account, le
                  prenotazioni e i progressi, ma perde l'accesso alla
                  gestione. Puoi rimetterlo quando vuoi.
                </Avviso>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConferma(false)}
                  className="flex-1 rounded-xl border border-bordo text-etichetta py-3.5 text-[12.5px] font-semibold"
                >
                  LASCIA STARE
                </button>
                <button
                  onClick={onRimuovi}
                  className="flex-1 rounded-xl bg-neutral-50 text-black py-3.5 text-[12.5px] font-bold"
                >
                  TORNA SOCIO
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="text-[11px] text-spento leading-relaxed mt-5">
        Nome, telefono e data di nascita si modificano dalla scheda socio,
        in Soci.
      </div>
    </div>
  );
}

/* Promuovere un socio. Si cerca per cognome fra chi è già registrato:
   da qui non si creano account e non si invitano indirizzi email. */
function Promuovi({ gia, onScelto, onIndietro }) {
  const [testo, setTesto] = useState("");
  const [soci, setSoci] = useState(null);
  const [scelto, setScelto] = useState(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      elencoSoci(testo)
        .then((l) => { if (vivo) setSoci(l); })
        .catch(() => { if (vivo) setSoci([]); });
    }, testo ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [testo]);

  const lista = (soci ?? []).filter(
    (s) => !gia.has(s.id) && s.ruolo === "socio" && s.stato === "approvato"
  );

  if (scelto) {
    return (
      <div className="px-5 pb-28 pt-1">
        <button
          onClick={() => setScelto(null)}
          aria-label="Torna alla ricerca"
          className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-[19px] font-display font-bold text-neutral-50 uppercase mt-2 mb-2">
          {scelto.nome} {scelto.cognome}
        </div>
        <div className="text-[11.5px] text-dettaglio mb-6">
          Che ruolo gli dai?
        </div>

        <div className="flex flex-col gap-2">
          {RUOLI.filter((r) => r.chiave === "coach" || r.chiave === "admin").map((r) => (
            <button
              key={r.chiave}
              onClick={() => onScelto(scelto, r.chiave)}
              className="rounded-2xl border border-bordo bg-scheda p-4 text-left"
            >
              <div className="text-[13.5px] text-neutral-100">{r.nome}</div>
              <div className="text-[11.5px] text-dettaglio mt-1 leading-relaxed">
                {r.spiega}
              </div>
            </button>
          ))}
        </div>

        <div className="text-[11px] text-spento leading-relaxed mt-4">
          Il ruolo si può cambiare dopo, e i permessi si aggiustano uno
          per uno dalla sua scheda.
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna allo staff"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="text-[19px] font-display font-bold text-neutral-50 uppercase mt-2 mb-5">
        Chi metti nello staff?
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-spento" />
        <input
          autoFocus
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Cognome o nome"
          className="w-full bg-scheda border border-bordo rounded-xl pl-10 pr-3 py-3 text-[13.5px] text-neutral-100 placeholder:text-spento outline-none focus:border-neutral-600"
        />
      </div>

      {soci === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-scheda animate-pulse" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Vuoto>
          {testo
            ? "Nessun socio approvato con questo nome."
            : "Non c'è nessun socio da promuovere."}
        </Vuoto>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.slice(0, 30).map((s) => (
            <button
              key={s.id}
              onClick={() => setScelto(s)}
              className="rounded-2xl border border-bordo bg-scheda p-3 flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
                <span className="text-[10.5px] font-display font-bold text-etichetta">
                  {`${s.nome?.[0] ?? ""}${s.cognome?.[0] ?? ""}`.toUpperCase()}
                </span>
              </div>
              <div className="text-[13.5px] text-neutral-100 truncate flex-1">
                {s.cognome} {s.nome}
              </div>
              <ChevronRight size={15} className="text-spento shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
