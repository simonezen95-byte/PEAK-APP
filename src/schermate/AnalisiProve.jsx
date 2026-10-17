import { useCallback, useEffect, useState } from "react";
import { UserRound, UserCheck, Percent, HelpCircle, Check, X } from "lucide-react";
import {
  proveRiassunto, provePerMese, provePerFonte, proveElenco,
  segnaEsitoProva, nomeFonte, fetteFonti, meseCorto,
} from "../lib/analisi";
import { Testata, Scelte, TitoloLista } from "../ui/pezzi-analisi";
import Ciambella from "../ui/Ciambella";
import { Card, Vuoto, Scheletro, Avviso } from "../ui/base";

/* Prove — l'analisi commerciale.

   Quante persone vengono a provare, da dove arrivano, quante si
   iscrivono. Dice se la pubblicità porta gente e se la prova viene
   gestita bene, che sono due cose diverse: una provenienza può
   portare molti e convertire poco.

   Nessuna riga qui dentro ha un nome. Una prova è una prenotazione
   senza nessuno dietro, la provenienza è una categoria e l'esito è
   una casella: i contatti stanno sul foglio della reception. Data e
   provenienza bastano a ritrovare la riga lì. */

export default function AnalisiProve({ onIndietro }) {
  const [n, setN] = useState(null);
  const [mesi, setMesi] = useState(null);
  const [fonti, setFonti] = useState(null);
  const [elenco, setElenco] = useState(null);
  const [periodo, setPeriodo] = useState(365);
  const [quantiMesi, setQuantiMesi] = useState(6);
  const [errore, setErrore] = useState("");
  const [lavoro, setLavoro] = useState(false);

  const carica = useCallback(async () => {
    setErrore("");
    try {
      const [a, b, c, d] = await Promise.all([
        proveRiassunto(periodo),
        provePerMese(quantiMesi),
        provePerFonte(periodo),
        proveElenco(60),
      ]);
      setN(a); setMesi(b); setFonti(c); setElenco(d);
    } catch {
      setErrore("Non riesco a leggere i dati.");
      setN(null); setMesi([]); setFonti([]); setElenco([]);
    }
  }, [periodo, quantiMesi]);

  useEffect(() => { carica(); }, [carica]);

  async function segna(riga, diventato) {
    setLavoro(true);
    try {
      await segnaEsitoProva(riga.id, diventato);
      await carica();
    } catch {
      setErrore("Non sono riuscito a salvare l'esito.");
    }
    setLavoro(false);
  }

  const torta = fetteFonti(fonti);
  const sospese = (elenco ?? []).filter((r) => r.esito === null);

  return (
    <div className="px-5 pb-28 pt-1">
      <Testata
        titolo="Prove"
        spiega="Quante persone vengono a provare e quante si iscrivono."
        nota="Le prove non hanno nome né contatto: qui c'è solo quante
              sono, da dove arrivano e com'è andata. I contatti restano
              sul foglio della reception, dove data e provenienza
              bastano a ritrovare la riga."
        onIndietro={onIndietro}
      />

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {!n && !errore ? (
        <Scheletro righe={3} />
      ) : n ? (
        <>
          <div className="flex justify-end mb-3">
            <Scelte
              valore={periodo}
              opzioni={[
                { v: 90, nome: "90 gg" },
                { v: 365, nome: "anno" },
              ]}
              onCambia={setPeriodo}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Riquadro icona={UserRound} valore={n.quante} nome="PROVE"
                      nota={periodo >= 365 ? "nell'ultimo anno" : "negli ultimi 90 giorni"} />
            <Riquadro icona={UserCheck} valore={n.convertite} nome="ISCRITTI"
                      nota={`${n.perse} non iscritti`} />
            <Riquadro
              icona={Percent}
              valore={n.conversione == null ? "–" : `${n.conversione}%`}
              nome="TASSO DI CONVERSIONE"
              nota={
                n.conversione == null
                  ? "nessun esito registrato"
                  : `su ${n.convertite + n.perse} esiti registrati`
              }
            />
            <Riquadro
              icona={HelpCircle}
              valore={n.in_sospeso}
              nome="ESITI DA REGISTRARE"
              nota={n.in_sospeso === 0 ? "nessuno in sospeso" : "in fondo alla schermata"}
              allarme={Number(n.in_sospeso) > 0}
            />
          </div>

          {/* ---------------- provenienza ---------------- */}
          <div className="mt-8">
            <TitoloLista nota="La provenienza che porta più persone non è
                               per forza quella che porta più iscritti:
                               il tasso di conversione per provenienza è
                               nell'elenco qui sotto.">
              PROVENIENZA
            </TitoloLista>

            {fonti === null ? (
              <Scheletro righe={2} />
            ) : torta.totale === 0 ? (
              <Vuoto>Nessuna prova nel periodo selezionato.</Vuoto>
            ) : (
              <>
                <Card className="mb-2">
                  <Ciambella pezzi={torta.pezzi} totale={torta.totale} sotto="PROVE" />
                </Card>
                <Card className="!p-0 divide-y divide-filo">
                  {fonti.map((f) => (
                    <RigaFonte key={f.fonte} f={f} />
                  ))}
                </Card>
              </>
            )}
          </div>

          {/* ---------------- mese per mese ---------------- */}
          <div className="mt-8">
            <TitoloLista
              nota="Una prova conta nel mese in cui la persona è venuta. La
                    barra chiara è chi poi si è iscritto."
              scelte={
                <Scelte
                  valore={quantiMesi}
                  opzioni={[
                    { v: 6, nome: "6 mesi" },
                    { v: 12, nome: "12 mesi" },
                  ]}
                  onCambia={setQuantiMesi}
                />
              }
            >
              ANDAMENTO MENSILE
            </TitoloLista>

            {mesi === null ? (
              <Scheletro righe={2} />
            ) : mesi.every((m) => Number(m.quante) === 0) ? (
              <Vuoto>Nessun dato nel periodo selezionato.</Vuoto>
            ) : (
              <Colonne righe={mesi} />
            )}
          </div>

          {/* ---------------- esiti da registrare ---------------- */}
          <div className="mt-8">
            <TitoloLista nota="Senza l'esito il tasso di conversione non si
                               può calcolare. Si può correggere in qualsiasi
                               momento: toccando di nuovo si torna in
                               sospeso.">
              {sospese.length > 0
                ? `DA REGISTRARE (${sospese.length})`
                : "ULTIME PROVE"}
            </TitoloLista>

            {elenco === null ? (
              <Scheletro righe={3} />
            ) : elenco.length === 0 ? (
              <Vuoto>Nessuna prova registrata.</Vuoto>
            ) : (
              <Card className="!p-0 divide-y divide-filo">
                {elenco.slice(0, 20).map((r) => (
                  <RigaProva key={r.id} r={r} lavoro={lavoro} onSegna={segna} />
                ))}
              </Card>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}


function Riquadro({ icona: Icona, valore, nome, nota, allarme }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        allarme ? "border-neutral-600 bg-rilievo" : "border-bordo bg-scheda"
      }`}
    >
      <Icona size={14} className="text-dettaglio mb-2" strokeWidth={1.8} />
      <div className="text-[19px] font-display font-bold text-neutral-50 leading-none tabular-nums">
        {valore ?? 0}
      </div>
      <div className="text-[8.5px] tracking-[0.1em] text-dettaglio mt-2 font-semibold leading-tight">
        {nome}
      </div>
      <div className="text-[9.5px] text-spento mt-1">{nota}</div>
    </div>
  );
}


function RigaFonte({ f }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-neutral-200 truncate">
          {nomeFonte(f.fonte)}
        </div>
        <div className="text-[10.5px] text-spento mt-0.5">
          {f.quante} {f.quante === 1 ? "prova" : "prove"} ·{" "}
          {f.convertite} {f.convertite === 1 ? "iscritto" : "iscritti"}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-display font-bold text-neutral-50 tabular-nums">
          {f.conversione == null ? "–" : `${f.conversione}%`}
        </div>
        <div className="text-[9px] text-spento mt-0.5">conversione</div>
      </div>
    </div>
  );
}


/* Le colonne dei mesi, con dentro la parte convertita.

   Due barre sovrapposte e non affiancate: la domanda è "di quelle
   prove, quante si sono iscritte", ed è una parte di un tutto. */
function Colonne({ righe }) {
  const massimo = Math.max(...righe.map((r) => Number(r.quante) || 0), 1);

  return (
    <Card>
      <div className="flex items-end justify-between gap-1.5 h-32">
        {righe.map((r, i) => {
          const q = Number(r.quante) || 0;
          const c = Number(r.convertite) || 0;
          const alta = Math.max(2, Math.round((q / massimo) * 100));
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              <div className="text-[8.5px] text-dettaglio tabular-nums">
                {q > 0 ? q : ""}
              </div>
              <div
                style={{ height: `${alta}%` }}
                className="w-full rounded-t bg-neutral-700 flex flex-col justify-end overflow-hidden"
              >
                {c > 0 && (
                  <div
                    style={{ height: `${Math.round((c / q) * 100)}%` }}
                    className="w-full bg-neutral-100"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-end justify-between gap-1.5 mt-2">
        {righe.map((r, i) => (
          <div key={i} className="flex-1 text-center text-[8.5px] text-spento">
            {meseCorto(r.mese)}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[9.5px] text-spento">
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-[2px] bg-neutral-100 inline-block" />
          iscritti
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-[2px] bg-neutral-700 inline-block" />
          non iscritti o in sospeso
        </span>
      </div>
    </Card>
  );
}


const MESI = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

function giorno(iso) {
  if (!iso) return "";
  const [, m, g] = String(iso).slice(0, 10).split("-").map(Number);
  if (!m || !g) return "";
  return `${g} ${MESI[m - 1]}`;
}

function RigaProva({ r, lavoro, onSegna }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-neutral-200">
          {giorno(r.quando)} · {nomeFonte(r.fonte)}
        </div>
        <div className="text-[10.5px] text-spento mt-0.5 truncate">
          {r.classe} delle {String(r.ora).slice(0, 5)}
        </div>
      </div>

      {/* Due bottoni invece di una spunta sola: "non si è iscritto" è
          una risposta, non l'assenza di una risposta, e va potuta
          dare. Toccando quello già acceso si torna in sospeso. */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Scelta
          attiva={r.esito === true}
          disabled={lavoro}
          etichetta="Si è iscritto"
          onClick={() => onSegna(r, r.esito === true ? null : true)}
        >
          <Check size={14} strokeWidth={2.4} />
        </Scelta>
        <Scelta
          attiva={r.esito === false}
          disabled={lavoro}
          etichetta="Non si è iscritto"
          onClick={() => onSegna(r, r.esito === false ? null : false)}
        >
          <X size={14} strokeWidth={2.4} />
        </Scelta>
      </div>
    </div>
  );
}

function Scelta({ attiva, children, etichetta, ...resto }) {
  return (
    <button
      {...resto}
      aria-label={etichetta}
      aria-pressed={attiva}
      className={`w-8 h-8 rounded-full flex items-center justify-center border ${
        attiva
          ? "bg-neutral-100 text-black border-neutral-100"
          : "border-filo text-spento"
      }`}
    >
      {children}
    </button>
  );
}
