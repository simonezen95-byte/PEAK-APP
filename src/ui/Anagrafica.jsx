import { useState } from "react";
import { Pencil, Mail, Phone, Hash } from "lucide-react";
import { modificaSocio, spiega } from "../lib/ruoli";
import { Titolo, Card, Campo, Bottone, Avviso, DataNascita } from "./base";
import { dataBreve } from "../lib/date";

/* I dati del socio, e per chi ha il permesso il modo di correggerli.

   Serviva: l'app diceva al socio "nome e data di nascita li aggiorna
   lo staff in reception", e in reception non c'era niente per farlo.

   L'email non si tocca da qui, di proposito. Quella scritta sulla
   scheda è l'indirizzo per scrivergli; quella con cui entra nell'app
   è un'altra cosa, tenuta altrove. Cambiarla qui lo lascerebbe a
   entrare con la vecchia, e nessuno capirebbe perché. */

export default function Anagrafica({ s, puoi, onCambiato, onMessaggio }) {
  const [apre, setApre] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nascita, setNascita] = useState("");
  const [comune, setComune] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");

  /* I campi si riempiono quando si apre, non al primo disegno: la
     scheda completa arriva dal database un attimo dopo, e partendo
     da quella di prima il modulo si aprirebbe senza data di nascita
     e senza comune — e salvando li cancellerebbe. */
  function apriModulo() {
    setNome(s.nome ?? "");
    setCognome(s.cognome ?? "");
    setTelefono(s.telefono ?? "");
    setNascita(s.data_nascita ?? "");
    setComune(s.comune ?? "");
    setErrore("");
    setApre(true);
  }

  async function salva() {
    setErrore("");
    setLavoro(true);
    try {
      const dati = { nome, cognome, telefono, data_nascita: nascita, comune };
      await modificaSocio(s.id, dati);
      onCambiato({
        nome: nome.trim(), cognome: cognome.trim(),
        telefono: telefono.trim(), data_nascita: nascita,
        comune: comune.trim() || null,
      });
      onMessaggio("Scheda aggiornata.");
      setApre(false);
    } catch (e) {
      setErrore(spiega(e));
    }
    setLavoro(false);
  }

  const pronto =
    nome.trim().length > 1 && cognome.trim().length > 1 &&
    telefono.trim().length > 5 && Boolean(nascita);

  // Senza data di nascita la scheda non e' ancora arrivata: meglio
  // dirlo che lasciare un bottone spento senza spiegazione.
  const incompleta = apre && !s.data_nascita;

  if (!apre) {
    return (
      <>
        <div className="flex items-center mb-3">
          <div className="text-[11px] tracking-[0.15em] text-dettaglio font-semibold flex-1">
            CONTATTI
          </div>
          {puoi && (
            <button
              onClick={apriModulo}
              className="flex items-center gap-1.5 text-[10.5px] tracking-[0.08em] text-etichetta font-semibold"
            >
              <Pencil size={12} />
              MODIFICA
            </button>
          )}
        </div>
        <Card className="divide-y divide-filo mb-6">
          <Dato icona={Mail} valore={s.email} />
          <Dato icona={Phone} valore={s.telefono} />
          {s.data_nascita && (
            <Dato icona={Hash} valore={`nato il ${dataBreve(s.data_nascita)}`} />
          )}
          {s.comune && <Dato icona={Hash} valore={s.comune} />}
        </Card>
      </>
    );
  }

  return (
    <div className="mb-6">
      <Titolo>MODIFICA LA SCHEDA</Titolo>

      {errore && <div className="mb-3"><Avviso>{errore}</Avviso></div>}

      {/* Ogni campo con la sua dicitura sopra: in un modulo che si
          apre gia' pieno, senza non si capisce se "Maser" sia il
          comune o un cognome. La data di nascita la scrive gia' da
          se', quindi li' non si ripete. */}
      <div className="flex flex-col gap-3 mb-3">
        <Voce nome="Nome">
          <Campo value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
        </Voce>
        <Voce nome="Cognome">
          <Campo value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Cognome" />
        </Voce>
        <Voce nome="Telefono">
          <Campo
            tipo="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Telefono"
          />
        </Voce>
        <Voce nome="Comune">
          <Campo value={comune} onChange={(e) => setComune(e.target.value)} placeholder="Comune" />
        </Voce>
        <DataNascita valore={nascita} onChange={setNascita} />
      </div>

      {incompleta && (
        <div className="mb-3">
          <Avviso>
            Non riesco a leggere la scheda completa di questa persona.
            Chiudi e riapri fra un momento: salvare adesso cancellerebbe
            la data di nascita.
          </Avviso>
        </div>
      )}

      <div className="text-[11px] text-spento leading-relaxed mb-4">
        L'email non si cambia da qui: quella scritta sulla scheda serve a
        scrivergli, ma per entrare nell'app vale quella con cui si è
        registrato. Cambiarla è un'altra cosa, e la deve fare lui.
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setApre(false)}
          className="flex-1 rounded-xl border border-bordo text-etichetta py-3.5 text-[12.5px] font-semibold"
        >
          LASCIA STARE
        </button>
        <div className="flex-1">
          <Bottone onClick={salva} disabled={!pronto || incompleta} carica={lavoro}>
            SALVA
          </Bottone>
        </div>
      </div>
    </div>
  );
}

function Voce({ nome, children }) {
  return (
    <div>
      <div className="text-[11px] text-dettaglio mb-1.5">{nome}</div>
      {children}
    </div>
  );
}

function Dato({ icona: Icona, valore }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Icona size={14} className="text-spento shrink-0" />
      <div className="text-[12.5px] text-neutral-300 truncate">{valore}</div>
    </div>
  );
}
