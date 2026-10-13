import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { aggiungiLezione, elencoCoach, spiega } from "../lib/classi";
import { Titolo, Avviso, Campo, Numeretto, Bottone } from "./base";
import { dataEstesa } from "../lib/date";

/* Una lezione in più nel giorno che si sta guardando: il seminario
   del sabato, la classe aggiunta sotto Natale.

   Non tocca il palinsesto. Il palinsesto è il modello della settimana
   tipo, e cambiarlo per una volta sola vorrebbe dire ricordarsi di
   rimetterlo a posto dopo. Questa resta un'eccezione di quel giorno,
   che è quello che è. */

export default function NuovaLezione({ giorno, onFatto, onMessaggio }) {
  const [aperto, setAperto] = useState(false);
  const [ora, setOra] = useState("18:00");
  const [nome, setNome] = useState("");
  const [posti, setPosti] = useState("15");
  const [durata, setDurata] = useState("60");
  const [tipo, setTipo] = useState("classe");
  const [coach, setCoach] = useState("");
  const [elenco, setElenco] = useState([]);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (!aperto) return;
    elencoCoach().then(setElenco).catch(() => setElenco([]));
  }, [aperto]);

  async function crea() {
    setErrore("");
    setLavoro(true);
    try {
      await aggiungiLezione({
        giorno,
        ora: `${ora}:00`,
        nome: nome.trim() || (tipo === "classe" ? "Functional" : "Open Box"),
        capienza: Number(posti),
        durata: Number(durata),
        tipo,
        coach: coach || null,
      });
      onMessaggio("Lezione aggiunta al calendario.");
      setAperto(false);
      setNome("");
      onFatto();
    } catch (e) {
      setErrore(spiega(e));
    }
    setLavoro(false);
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="w-full rounded-2xl border border-dashed border-bordo p-3.5 flex items-center justify-center gap-2.5 text-neutral-400 mt-6"
      >
        <Plus size={15} strokeWidth={2} />
        <span className="text-[12.5px] font-semibold">Aggiungi una lezione</span>
      </button>
    );
  }

  const pronto = /^\d{2}:\d{2}$/.test(ora) && Number(posti) >= 1 && Number(durata) >= 10;

  return (
    <div className="mt-6 rounded-2xl border border-bordo bg-scheda p-4">
      <div className="flex items-start mb-4">
        <div className="flex-1">
          <Titolo>NUOVA LEZIONE</Titolo>
          <div className="text-[11.5px] text-neutral-500 -mt-2 first-letter:uppercase">
            {dataEstesa(giorno)}
          </div>
        </div>
        <button
          onClick={() => { setAperto(false); setErrore(""); }}
          aria-label="Chiudi"
          className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center text-neutral-600 shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTipo("classe")}
          className={`flex-1 rounded-xl py-2.5 text-[12px] font-semibold border ${
            tipo === "classe"
              ? "bg-neutral-50 border-neutral-50 text-black"
              : "border-bordo text-neutral-400"
          }`}
        >
          CLASSE
        </button>
        <button
          onClick={() => setTipo("openbox")}
          className={`flex-1 rounded-xl py-2.5 text-[12px] font-semibold border ${
            tipo === "openbox"
              ? "bg-neutral-50 border-neutral-50 text-black"
              : "border-bordo text-neutral-400"
          }`}
        >
          OPEN BOX
        </button>
      </div>

      <div className="flex flex-col gap-2.5 mb-3">
        <Campo
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={tipo === "classe" ? "Functional" : "Open Box"}
        />
        {/* Le diciture stanno sopra e non dentro: in due colonne,
            fra il meno e il più, resta spazio per una lettera e la
            parola veniva tagliata a "m...". */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="text-[11px] text-neutral-500 mb-1.5">Ora</div>
            {/* L'ora a tendina del telefono: scriverla a mano su uno
                schermo piccolo è il modo più facile per sbagliarla. */}
            <Campo tipo="time" value={ora} onChange={(e) => setOra(e.target.value)} />
          </div>
          <div>
            <div className="text-[11px] text-neutral-500 mb-1.5">Durata, minuti</div>
            <Numeretto valore={durata} onCambia={setDurata} etichetta="" />
          </div>
        </div>
        <div>
          <div className="text-[11px] text-neutral-500 mb-1.5">Posti</div>
          <Numeretto valore={posti} onCambia={setPosti} etichetta="" />
        </div>

        {tipo === "classe" && (
          <div className="bg-scheda border border-bordo rounded-xl px-3.5 focus-within:border-neutral-600">
            <select
              value={coach}
              onChange={(e) => setCoach(e.target.value)}
              className="w-full bg-transparent py-3.5 text-[14px] text-neutral-50 outline-none"
            >
              <option value="">Coach da assegnare</option>
              {elenco.map((c) => (
                <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Bottone onClick={crea} disabled={!pronto} carica={lavoro}>
        AGGIUNGI AL CALENDARIO
      </Bottone>
    </div>
  );
}
