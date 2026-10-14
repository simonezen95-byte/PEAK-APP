import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Plus, Pencil, Power, Euro } from "lucide-react";
import {
  listino, creaPacchetto, modificaPacchetto, spegniPacchetto, quantiInUso,
  FORME, formaDi, colonneDi, descrizione, durata,
} from "../lib/pacchetti";
import {
  Card, Titolo, Avviso, Vuoto, Campo, Bottone, Numeretto,
} from "../ui/base";

/* Il listino, modificabile dal titolare.

   Serve perché i prezzi cambiano — a inizio stagione, per una
   promozione, quando si aggiunge una formula — e cambiarli non deve
   voler dire riscrivere il codice e ripubblicare l'app.

   Un pacchetto non si cancella mai: si spegne. Gli abbonamenti già
   venduti puntano al pacchetto, e cancellarlo vorrebbe dire perdere
   il nome di cosa ha comprato un socio l'anno scorso. */

export default function Listino({ onIndietro, onMessaggio }) {
  const [righe, setRighe] = useState(null);
  const [apre, setApre] = useState(null);     // il pacchetto in modifica
  const [nuovo, setNuovo] = useState(false);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    try {
      setRighe(await listino());
    } catch {
      setErrore("Non riesco a leggere il listino.");
      setRighe([]);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  async function salva(dati, id) {
    setErrore("");
    try {
      if (id) await modificaPacchetto(id, dati);
      else await creaPacchetto(dati);
      setApre(null);
      setNuovo(false);
      await carica();
      onMessaggio(id ? "Pacchetto aggiornato." : "Pacchetto creato.");
    } catch (e) {
      setErrore(
        String(e?.message || "").includes("row-level security")
          ? "Non hai il permesso di modificare il listino."
          : "Non sono riuscito a salvare. Riprova."
      );
    }
  }

  async function accendi(p) {
    setErrore("");
    try {
      await spegniPacchetto(p.id, !p.attivo);
      await carica();
      onMessaggio(
        p.attivo
          ? `"${p.nome}" non è più in vendita.`
          : `"${p.nome}" è di nuovo in vendita.`
      );
    } catch {
      setErrore("Non sono riuscito a cambiare lo stato del pacchetto.");
    }
  }

  if (nuovo || apre) {
    return (
      <Scheda
        pacchetto={apre}
        onSalva={(dati) => salva(dati, apre?.id)}
        onIndietro={() => { setApre(null); setNuovo(false); setErrore(""); }}
        errore={errore}
      />
    );
  }

  const abbonamenti = (righe ?? []).filter((p) => p.tipo === "abbonamento");
  const personal = (righe ?? []).filter((p) => p.tipo === "personal");

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna al profilo"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="mt-2 mb-6">
        <div className="text-[21px] font-display font-bold text-neutral-50 uppercase leading-tight">
          Listino
        </div>
        <div className="text-[11.5px] text-neutral-500 mt-1 leading-relaxed">
          Quello che la reception può vendere. Le modifiche valgono dai
          nuovi abbonamenti: quelli già registrati restano com'erano.
        </div>
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {righe === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-scheda animate-pulse" />
          ))}
        </div>
      ) : righe.length === 0 ? (
        <Vuoto>Non c'è ancora nessun pacchetto.</Vuoto>
      ) : (
        <>
          <Titolo>ABBONAMENTI</Titolo>
          <div className="flex flex-col gap-2 mb-7">
            {abbonamenti.map((p) => (
              <Riga key={p.id} p={p} onApri={() => setApre(p)} onAccendi={() => accendi(p)} />
            ))}
          </div>

          {personal.length > 0 && (
            <>
              <Titolo>PERSONAL TRAINING</Titolo>
              <div className="flex flex-col gap-2 mb-7">
                {personal.map((p) => (
                  <Riga key={p.id} p={p} onApri={() => setApre(p)} onAccendi={() => accendi(p)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button
        onClick={() => setNuovo(true)}
        className="w-full rounded-2xl border border-dashed border-bordo p-3.5 flex items-center justify-center gap-2.5 text-neutral-400"
      >
        <Plus size={16} strokeWidth={2} />
        <span className="text-[12.5px] font-semibold">Nuovo pacchetto</span>
      </button>
    </div>
  );
}

function Riga({ p, onApri, onAccendi }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 flex items-center gap-3 ${
        p.attivo ? "border-bordo bg-scheda" : "border-filo bg-transparent"
      }`}
    >
      <button onClick={onApri} className="flex-1 text-left min-w-0">
        <div className={`text-[13.5px] truncate ${p.attivo ? "text-neutral-100" : "text-neutral-600"}`}>
          {p.nome}
        </div>
        {/* "Non in vendita" sta qui sotto e non in fondo al nome:
            un nome un po' lungo lo tagliava via proprio quando
            serviva leggerlo. */}
        <div className="text-[10.5px] text-neutral-500 mt-0.5 truncate">
          {durata(p)} · {descrizione(p)}
          {!p.attivo && <span className="text-neutral-400"> · non in vendita</span>}
        </div>
      </button>

      <div className={`text-[15px] font-display font-bold shrink-0 tabular-nums ${
        p.attivo ? "text-neutral-50" : "text-neutral-700"
      }`}>
        {Number(p.prezzo) === 0
          ? <span className="text-[11px] tracking-wider">GRATUITO</span>
          : <>{Number(p.prezzo).toFixed(0)}&thinsp;€</>}
      </div>

      <button
        onClick={onApri}
        aria-label={`Modifica ${p.nome}`}
        className="w-8 h-8 flex items-center justify-center text-neutral-600 shrink-0"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={onAccendi}
        aria-label={p.attivo ? `Togli ${p.nome} dalla vendita` : `Rimetti ${p.nome} in vendita`}
        className={`w-8 h-8 flex items-center justify-center shrink-0 ${
          p.attivo ? "text-neutral-600" : "text-neutral-400"
        }`}
      >
        <Power size={14} />
      </button>
    </div>
  );
}

/* La scheda di un pacchetto.

   Non si compilano le colonne del database una per una: si sceglie
   che FORMA ha il pacchetto, e le colonne si riempiono da sole. Così
   non si può scrivere un pacchetto a ingressi che però non apre le
   classi — una riga che il database accetterebbe e che in reception
   non si saprebbe come spiegare. */
function Scheda({ pacchetto, onSalva, onIndietro, errore }) {
  const p = pacchetto;
  const [nome, setNome] = useState(p?.nome ?? "");
  const [prezzo, setPrezzo] = useState(p ? String(p.prezzo) : "");
  const [mesi, setMesi] = useState(String(p?.mesi ?? 1));
  const [tipo, setTipo] = useState(p?.tipo ?? "abbonamento");
  const [forma, setForma] = useState(p ? formaDi(p) : "illimitato");
  const [numero, setNumero] = useState(
    p ? String(p.lezioni_settimana ?? p.ingressi ?? "") : ""
  );
  const [sessioni, setSessioni] = useState(String(p?.sessioni ?? 1));
  const [inUso, setInUso] = useState(null);
  const [lavoro, setLavoro] = useState(false);

  useEffect(() => {
    if (p?.id) quantiInUso(p.id).then(setInUso).catch(() => setInUso(null));
  }, [p?.id]);

  const scelta = FORME.find((f) => f.chiave === forma);
  const serveNumero = Boolean(scelta?.numero);

  /* Zero è un prezzo valido: serve per gli abbonamenti omaggio —
     la compagna di un socio, una sorella, chi dà una mano. Quello che
     non va bene è il campo lasciato vuoto: "" letto come numero fa
     zero, e si creerebbe un pacchetto gratis per distrazione. Per
     questo il campo deve contenere qualcosa, e quel qualcosa deve
     essere un numero da zero in su. */
  const prezzoScritto = prezzo.trim();
  const prezzoOk =
    prezzoScritto !== "" &&
    Number.isFinite(Number(prezzoScritto)) &&
    Number(prezzoScritto) >= 0;

  const pronto =
    nome.trim().length > 1 &&
    prezzoOk &&
    Number(mesi) >= 1 &&
    (tipo === "personal" ? Number(sessioni) >= 1 : !serveNumero || Number(numero) >= 1);

  function salva() {
    setLavoro(true);
    const base = {
      nome: nome.trim(),
      tipo,
      prezzo: Number(prezzo),
      mesi: Number(mesi),
    };
    const dati = tipo === "personal"
      ? { ...base, sessioni: Number(sessioni), include_classi: true,
          ingressi: null, lezioni_settimana: null }
      : { ...base, sessioni: null,
          ...colonneDi(forma, serveNumero ? Number(numero) : null) };
    onSalva(dati);
    setLavoro(false);
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna al listino"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="text-[21px] font-display font-bold text-neutral-50 uppercase mt-2 mb-6">
        {p ? "Modifica pacchetto" : "Nuovo pacchetto"}
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {inUso > 0 && (
        <div className="mb-5">
          <Avviso tono="nota">
            {inUso === 1
              ? "Un socio ha questo abbonamento attivo adesso."
              : `${inUso} soci hanno questo abbonamento attivo adesso.`}{" "}
            Quello che cambi qui vale per i prossimi: il loro resta com'era
            quando l'hanno comprato.
          </Avviso>
        </div>
      )}

      <Titolo>NOME E PREZZO</Titolo>
      <div className="flex flex-col gap-2.5 mb-7">
        <Campo
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome del pacchetto"
          autoFocus={!p}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Campo
            icona={Euro}
            tipo="number"
            inputMode="decimal"
            value={prezzo}
            onChange={(e) => setPrezzo(e.target.value)}
            placeholder="Prezzo"
          />
          <Numeretto
            valore={mesi}
            onCambia={setMesi}
            etichetta={Number(mesi) === 1 ? "mese" : "mesi"}
          />
        </div>
      </div>

      <Titolo>CHE COS'È</Titolo>
      <div className="flex flex-col gap-2 mb-5">
        <Tipo
          attivo={tipo === "abbonamento"}
          nome="Abbonamento"
          spiega="Si rinnova. È quello che compra quasi tutti."
          onClick={() => setTipo("abbonamento")}
        />
        <Tipo
          attivo={tipo === "personal"}
          nome="Personal training"
          spiega="Un pacchetto di sessioni individuali."
          onClick={() => setTipo("personal")}
        />
      </div>

      {tipo === "personal" ? (
        <div className="mb-7">
          <Numeretto
            valore={sessioni}
            onCambia={setSessioni}
            etichetta={Number(sessioni) === 1 ? "sessione" : "sessioni"}
          />
        </div>
      ) : (
        <>
          <Titolo>QUANTO SI ALLENA</Titolo>
          <div className="flex flex-col gap-2 mb-5">
            {FORME.map((f) => (
              <Tipo
                key={f.chiave}
                attivo={forma === f.chiave}
                nome={f.nome}
                spiega={f.spiega}
                onClick={() => setForma(f.chiave)}
              />
            ))}
          </div>

          {serveNumero && (
            <div className="mb-7">
              <div className="text-[11.5px] text-neutral-500 mb-2">{scelta.numero}</div>
              <Numeretto
                valore={numero}
                onCambia={setNumero}
                etichetta={forma === "ingressi" ? "ingressi" : "a settimana"}
              />
            </div>
          )}
        </>
      )}

      <Card className="mb-6">
        <div className="text-[10px] tracking-[0.15em] text-neutral-600 font-semibold mb-2">
          COME SI LEGGERÀ
        </div>
        <div className="text-[13px] text-neutral-100">
          {nome.trim() || "Nome del pacchetto"}
        </div>
        <div className="text-[11px] text-neutral-500 mt-1">
          {Number(mesi) === 1 ? "1 mese" : `${mesi} mesi`} ·{" "}
          {anteprima(tipo, forma, numero, sessioni)} ·{" "}
          {prezzoScritto === ""
            ? "— €"
            : Number(prezzoScritto) === 0
              ? "gratuito"
              : `${Number(prezzoScritto).toFixed(0)} €`}
        </div>
      </Card>

      <Bottone onClick={salva} disabled={!pronto} carica={lavoro}>
        {p ? "SALVA" : "CREA PACCHETTO"}
      </Bottone>
    </div>
  );
}

function anteprima(tipo, forma, numero, sessioni) {
  if (tipo === "personal") {
    return `${sessioni || 1} ${Number(sessioni) === 1 ? "sessione" : "sessioni"}`;
  }
  if (forma === "ingressi")  return `${numero || "—"} ingressi`;
  if (forma === "settimana") return `${numero || "—"} a settimana`;
  if (forma === "openbox")   return "solo Open Box";
  return "illimitato";
}

function Tipo({ attivo, nome, spiega, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={attivo}
      className={`rounded-2xl border p-3.5 text-left flex items-start gap-3 ${
        attivo ? "border-neutral-400 bg-neutral-50/[0.07]" : "border-bordo bg-scheda"
      }`}
    >
      <div
        className={`w-[18px] h-[18px] rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
          attivo ? "border-neutral-50" : "border-neutral-600"
        }`}
      >
        {attivo && <div className="w-2.5 h-2.5 rounded-full bg-neutral-50" />}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] text-neutral-100">{nome}</div>
        <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{spiega}</div>
      </div>
    </button>
  );
}
