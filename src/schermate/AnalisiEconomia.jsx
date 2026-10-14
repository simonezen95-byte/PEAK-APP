import { useCallback, useEffect, useState } from "react";
import { Wallet, CalendarClock, Clock3, Tag } from "lucide-react";
import {
  economiaRiassunto, economiaPerMese, economiaPerPacchetto,
  euro, meseCorto, fette,
} from "../lib/analisi";
import Ciambella from "../ui/Ciambella";
import { Testata, Scelte, TitoloLista } from "../ui/pezzi-analisi";
import { Card, Vuoto, Scheletro, Avviso } from "../ui/base";

/* Economia — che aria tira, in soldi.

   Non è la contabilità dell'associazione e non deve diventarlo. È il
   quadro di cosa portano abbonamenti e quote, che è la parte che
   l'app conosce davvero.

   Questo è scritto anche in testa alla schermata, in chiaro. Un
   numero con l'euro accanto viene creduto: se non si dice subito cosa
   c'è dentro e cosa no, qualcuno prima o poi lo confronterà con
   l'estratto conto e penserà che l'app sbaglia. */

export default function AnalisiEconomia({ onIndietro }) {
  const [n, setN] = useState(null);
  const [mesi, setMesi] = useState(null);
  const [pacchetti, setPacchetti] = useState(null);
  const [quanti, setQuanti] = useState(6);
  const [periodo, setPeriodo] = useState(90);
  const [errore, setErrore] = useState("");

  const carica = useCallback(async () => {
    setErrore("");
    try {
      const [a, b, c] = await Promise.all([
        economiaRiassunto(),
        economiaPerMese(quanti),
        economiaPerPacchetto(periodo),
      ]);
      setN(a); setMesi(b); setPacchetti(c);
    } catch {
      setErrore("Non riesco a leggere i dati.");
      setN(null); setMesi([]); setPacchetti([]);
    }
  }, [quanti, periodo]);

  useEffect(() => { carica(); }, [carica]);

  const torta = fette(pacchetti);

  return (
    <div className="px-5 pb-28 pt-1">
      <Testata
        titolo="Economia"
        spiega="Quanto portano abbonamenti e quote. Non è la cassa: i
                pagamenti non passano dall'app, e i valori sono quelli di
                listino."
        onIndietro={onIndietro}
      />

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {!n && !errore ? (
        <Scheletro righe={3} />
      ) : n ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Riquadro
              icona={Wallet}
              valore={euro(n.attivi_valore)}
              nome="ABBONAMENTI IN CORSO"
              nota={quantiEChi(n.attivi_quanti, n.attivi_persone)}
            />
            <Riquadro
              icona={CalendarClock}
              valore={euro(n.mese_valore)}
              nome="PARTITI QUESTO MESE"
              nota={`${n.mese_quanti} ${n.mese_quanti === 1 ? "abbonamento" : "abbonamenti"}, più le quote`}
            />
            {/* Non è una perdita: è il lavoro da fare. */}
            <Riquadro
              icona={Clock3}
              valore={euro(n.scadenze_valore)}
              nome="DA RINNOVARE"
              nota={`${n.scadenze_quanti} entro 30 giorni`}
            />
            <Riquadro
              icona={Tag}
              valore={euro(n.sospeso_valore)}
              nome="SEGNATI NON PAGATI"
              nota={
                n.sospeso_quanti === 0
                  ? "niente in sospeso"
                  : `${n.sospeso_quanti} da sistemare`
              }
              allarme={Number(n.sospeso_quanti) > 0}
            />
          </div>

          <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
            I valori vengono dal listino di oggi, non dal prezzo
            davvero incassato: sconti, rate, merchandising e tutto il
            resto non ci sono. Le quote annuali invece hanno l'importo
            scritto quando le registri, e quello è il soldo vero.
          </div>

          {/* ---------------- mese per mese ---------------- */}
          <div className="mt-8">
            <TitoloLista
              scelte={
                <Scelte
                  valore={quanti}
                  opzioni={[
                    { v: 6, nome: "6 mesi" },
                    { v: 12, nome: "12 mesi" },
                  ]}
                  onCambia={setQuanti}
                />
              }
            >
              MESE PER MESE
            </TitoloLista>

            {mesi === null ? (
              <Scheletro righe={2} />
            ) : mesi.every((m) => Number(m.totale) === 0) ? (
              <Vuoto>Ancora niente da mostrare.</Vuoto>
            ) : (
              <Colonne righe={mesi} />
            )}
            <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
              Un abbonamento conta tutto nel mese in cui comincia, non
              spalmato: è il mese in cui la persona ha deciso, ed è
              quello che serve vedere.
            </div>
          </div>

          {/* ---------------- vendite per pacchetto ---------------- */}
          <div className="mt-8">
            <TitoloLista
              scelte={
                <Scelte
                  valore={periodo}
                  opzioni={[
                    { v: 30, nome: "30 gg" },
                    { v: 90, nome: "90 gg" },
                    { v: 365, nome: "anno" },
                  ]}
                  onCambia={setPeriodo}
                />
              }
            >
              VENDITE PER PACCHETTO
            </TitoloLista>

            {pacchetti === null ? (
              <Scheletro righe={2} />
            ) : torta.totale === 0 ? (
              <Vuoto>
                Nessun abbonamento venduto {quandoDa(periodo)}.
              </Vuoto>
            ) : (
              <>
                <Card className="mb-2">
                  <Ciambella
                    pezzi={torta.pezzi}
                    totale={torta.totale}
                    sotto="VENDUTI"
                  />
                </Card>
                <Card className="!p-0 divide-y divide-filo">
                  {pacchetti.map((p, i) => (
                    <RigaPacchetto key={i} p={p} />
                  ))}
                </Card>
              </>
            )}

            <div className="text-[10.5px] text-neutral-600 mt-3 leading-relaxed">
              Abbonamenti cominciati {quandoDa(periodo)}, in ordine di
              quantità. Nel grafico i primi cinque, il resto raccolto
              in "Altri"; l'elenco sotto è completo e comprende i
              pacchetti che non ha preso nessuno.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}


/* "4 abbonamenti" e "3 persone" non sono la stessa cosa.

   Succede quando qualcuno ha due abbonamenti che si sovrappongono: un
   rinnovo registrato in anticipo, un omaggio aggiunto sopra a uno
   attivo. Finché i due numeri coincidono se ne scrive uno solo;
   quando si separano si scrivono tutt'e due, invece di sceglierne uno
   e lasciar credere che sia l'altro. */
function quantiEChi(quanti, persone) {
  const a = Number(quanti) || 0;
  const p = Number(persone) || 0;
  if (a === p) return `${p} ${p === 1 ? "persona" : "persone"}`;
  return `${a} abbonamenti su ${p} ${p === 1 ? "persona" : "persone"}`;
}

/** "negli ultimi 90 giorni", "nell'ultimo anno": il periodo scritto
    come lo si direbbe a voce. */
function quandoDa(giorni) {
  if (giorni >= 365) return "nell'ultimo anno";
  if (giorni >= 180) return "negli ultimi sei mesi";
  return `negli ultimi ${giorni} giorni`;
}

function Riquadro({ icona: Icona, valore, nome, nota, allarme }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        allarme ? "border-neutral-600 bg-rilievo" : "border-bordo bg-scheda"
      }`}
    >
      <Icona size={14} className="text-neutral-500 mb-2" strokeWidth={1.8} />
      <div className="text-[19px] font-display font-bold text-neutral-50 leading-none tabular-nums">
        {valore}
      </div>
      <div className="text-[8.5px] tracking-[0.1em] text-neutral-500 mt-2 font-semibold leading-tight">
        {nome}
      </div>
      <div className="text-[9.5px] text-neutral-600 mt-1">{nota}</div>
    </div>
  );
}


/* Le colonne dei mesi.

   Niente libreria di grafici: sono barre, e una barra è un rettangolo
   alto quanto serve. Una libreria qui vorrebbe dire trecento chili di
   roba da scaricare per disegnare sei rettangoli. */
function Colonne({ righe }) {
  const massimo = Math.max(...righe.map((r) => Number(r.totale) || 0), 1);

  return (
    <Card>
      <div className="flex items-end justify-between gap-1.5 h-32">
        {righe.map((r, i) => {
          const v = Number(r.totale) || 0;
          const alta = Math.max(2, Math.round((v / massimo) * 100));
          const ultimo = i === righe.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              <div className="text-[8.5px] text-neutral-500 tabular-nums">
                {v > 0 ? Math.round(v) : ""}
              </div>
              <div
                style={{ height: `${alta}%` }}
                className={`w-full rounded-t ${
                  ultimo ? "bg-neutral-100" : "bg-neutral-700"
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-end justify-between gap-1.5 mt-2">
        {righe.map((r, i) => (
          <div key={i} className="flex-1 text-center text-[8.5px] text-neutral-600">
            {meseCorto(r.mese)}
          </div>
        ))}
      </div>
    </Card>
  );
}


function RigaPacchetto({ p }) {
  const venduti = Number(p.venduti) || 0;
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="flex-1 min-w-0">
        <div
          className={`text-[12.5px] truncate ${
            p.spento ? "text-neutral-600" : "text-neutral-200"
          }`}
        >
          {p.pacchetto}
          {p.spento && (
            <span className="text-neutral-500 text-[10.5px]"> · non in vendita</span>
          )}
        </div>
        <div className="text-[10.5px] text-neutral-600 mt-0.5">
          {Number(p.prezzo) === 0 ? "gratuito" : euro(p.prezzo)}
          {venduti > 0 && ` · ${p.attivi} in corso`}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`text-[13px] font-display font-bold tabular-nums ${
            venduti > 0 ? "text-neutral-50" : "text-neutral-700"
          }`}
        >
          {venduti}
        </div>
        <div className="text-[9px] text-neutral-600 mt-0.5 tabular-nums">
          {venduti > 0 ? euro(p.valore) : "mai venduto"}
        </div>
      </div>
    </div>
  );
}
