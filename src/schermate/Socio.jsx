import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft, Mail, Phone, Hash, Check, AlertTriangle,
  Stethoscope, IdCard, CreditCard,
} from "lucide-react";
import { useSessione } from "../lib/sessione";
import {
  storicoSocio, catalogo, elencoSoci, cambiaStato, registraCertificato,
  registraQuota, attivaAbbonamento, stagioneCorrente,
  puoApprovare, puoGestireAbbonamenti,
} from "../lib/staff";
import { dataBreve, oggiIso, piuGiorni } from "../lib/date";
import { Card, Titolo, Avviso, Bottone } from "../ui/base";

/* La scheda di un socio come la vede la reception: cosa gli manca e
   i tre bottoni per sistemarlo. */

export default function Socio({ socio, onIndietro, onCambiato, onMessaggio }) {
  const { profilo } = useSessione();
  const [s, setS] = useState(socio);
  const [storico, setStorico] = useState(null);
  const [pacchetti, setPacchetti] = useState([]);
  const [apre, setApre] = useState(null);      // 'certificato' | 'quota' | 'abbonamento'
  const [errore, setErrore] = useState("");
  const [lavoro, setLavoro] = useState(false);

  const oggi = oggiIso();
  const certOk  = s.certificato_scadenza && s.certificato_scadenza >= oggi;
  const quotaOk = s.quota_fino && s.quota_fino >= oggi;
  const abbOk   = Boolean(s.abbonamento);

  const posso = puoApprovare(profilo);
  const possoAbb = puoGestireAbbonamenti(profilo);

  const carica = useCallback(async () => {
    try {
      // Rileggo anche il riepilogo del socio: dopo aver attivato un
      // abbonamento o registrato una quota, quello che ho in mano
      // è vecchio di un secondo ma già sbagliato.
      const [st, cat, elenco] = await Promise.all([
        storicoSocio(s.id),
        catalogo(),
        elencoSoci(s.email ?? ""),
      ]);
      setStorico(st);
      setPacchetti(cat);
      const aggiornato = elenco.find((r) => r.id === s.id);
      if (aggiornato) setS(aggiornato);
    } catch {
      setStorico([]);
    }
  }, [s.id, s.email]);

  useEffect(() => { carica(); }, [carica]);

  async function esegui(fn, messaggio, aggiorna) {
    setErrore("");
    setLavoro(true);
    try {
      await fn();
      setS((v) => ({ ...v, ...aggiorna }));
      setApre(null);
      onMessaggio(messaggio);
      await carica();
      onCambiato();
    } catch (e) {
      setErrore(leggibile(e));
    }
    setLavoro(false);
  }

  return (
    <div className="px-5 pb-28 pt-1">
      <button
        onClick={onIndietro}
        aria-label="Torna all'elenco"
        className="w-10 h-10 -ml-2 flex items-center justify-center text-neutral-300"
      >
        <ChevronLeft size={22} />
      </button>

      {/* Chi è */}
      <div className="flex items-center gap-4 mt-2 mb-6">
        <div className="w-14 h-14 rounded-full border border-neutral-700 flex items-center justify-center shrink-0">
          <span className="text-[16px] font-display font-bold text-neutral-400">
            {(s.nome?.[0] ?? "") + (s.cognome?.[0] ?? "")}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[20px] font-display font-bold text-neutral-50 leading-tight truncate">
            {s.nome} {s.cognome}
          </div>
          <div className="text-[11.5px] text-neutral-500 mt-0.5">
            {s.stato === "in_attesa" ? "in attesa di approvazione"
             : s.stato === "sospeso" ? "sospeso"
             : s.ruolo !== "socio" ? s.ruolo
             : "socio"}
            {s.numero_tessera ? ` · tessera ${s.numero_tessera}` : ""}
          </div>
        </div>
      </div>

      {errore && <div className="mb-5"><Avviso>{errore}</Avviso></div>}

      {/* Approvazione */}
      {posso && s.stato === "in_attesa" && (
        <Card className="mb-5 border-neutral-400 bg-neutral-50/[0.07]">
          <div className="text-[12.5px] text-neutral-300 leading-relaxed mb-3.5">
            Questa persona si è registrata e aspetta. Approvala quando l'hai
            vista in reception e hai controllato i documenti.
          </div>
          <Bottone
            carica={lavoro}
            onClick={() => esegui(
              () => cambiaStato(s.id, "approvato"),
              "Socio approvato.",
              { stato: "approvato" }
            )}
          >
            APPROVA
          </Bottone>
        </Card>
      )}

      {/* Le tre cose */}
      <Titolo>REQUISITI</Titolo>
      <div className="flex flex-col gap-2.5 mb-6">
        <Requisito
          icona={Stethoscope}
          nome="Certificato medico"
          ok={certOk}
          valore={s.certificato_scadenza
            ? `scade il ${dataBreve(s.certificato_scadenza)}`
            : "mancante"}
          azione={posso ? () => setApre(apre === "certificato" ? null : "certificato") : null}
          aperto={apre === "certificato"}
        >
          <FormCertificato
            lavoro={lavoro}
            onSalva={(data) => esegui(
              () => registraCertificato(s.id, data),
              "Certificato registrato.",
              { certificato_scadenza: data }
            )}
          />
        </Requisito>

        <Requisito
          icona={IdCard}
          nome="Quota associativa"
          ok={quotaOk}
          valore={s.quota_fino
            ? `stagione fino al ${dataBreve(s.quota_fino)}`
            : "non versata"}
          azione={possoAbb ? () => setApre(apre === "quota" ? null : "quota") : null}
          aperto={apre === "quota"}
        >
          <FormQuota
            lavoro={lavoro}
            onSalva={(anno, importo) => esegui(
              () => registraQuota(s.id, anno, importo),
              "Quota registrata.",
              { quota_fino: `${anno}-08-31` }
            )}
          />
        </Requisito>

        <Requisito
          icona={CreditCard}
          nome="Abbonamento"
          ok={abbOk}
          valore={s.abbonamento
            ? `${s.abbonamento}, fino al ${dataBreve(s.abbonamento_fine)}${
                s.residui != null ? ` · ${s.residui} ingressi` : ""
              }`
            : "nessuno attivo"}
          azione={possoAbb ? () => setApre(apre === "abbonamento" ? null : "abbonamento") : null}
          aperto={apre === "abbonamento"}
        >
          <FormAbbonamento
            pacchetti={pacchetti}
            lavoro={lavoro}
            onSalva={(pacchetto, inizio, pagato) => esegui(
              async () => {
                const fine = await attivaAbbonamento(s.id, pacchetto, inizio, pagato);
                return fine;
              },
              "Abbonamento attivato.",
              {}   // il quadro aggiornato lo rilegge carica()
            )}
          />
        </Requisito>
      </div>

      {/* Contatti */}
      <Titolo>CONTATTI</Titolo>
      <Card className="divide-y divide-neutral-800 mb-6">
        <Dato icona={Mail} valore={s.email} />
        <Dato icona={Phone} valore={s.telefono} />
        <Dato icona={Hash} valore={`iscritto il ${dataBreve(String(s.iscritto_il).slice(0, 10))}`} />
      </Card>

      {/* Storico */}
      <Titolo>STORICO</Titolo>
      {storico === null ? (
        <div className="h-16 rounded-2xl bg-neutral-900 animate-pulse" />
      ) : storico.length === 0 ? (
        <div className="text-[12px] text-neutral-600 mb-6">Ancora niente.</div>
      ) : (
        <Card className="divide-y divide-neutral-800 mb-6">
          {storico.map((v, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-[12.5px] text-neutral-200 truncate">{v.descrizione}</div>
                <div className="text-[10.5px] text-neutral-600 mt-0.5">
                  {dataBreve(v.dal)} – {dataBreve(v.al)}
                  {v.totali != null && ` · ${v.residui}/${v.totali}`}
                </div>
              </div>
              {!v.pagato && (
                <span className="text-[9.5px] font-bold tracking-wider text-amber-300 border border-amber-900 rounded-full px-2 py-0.5 shrink-0 ml-2">
                  NON PAGATO
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Sospensione */}
      {posso && s.stato !== "in_attesa" && (
        <button
          onClick={() => esegui(
            () => cambiaStato(s.id, s.stato === "sospeso" ? "approvato" : "sospeso"),
            s.stato === "sospeso" ? "Socio riattivato." : "Socio sospeso.",
            { stato: s.stato === "sospeso" ? "approvato" : "sospeso" }
          )}
          disabled={lavoro}
          className="w-full rounded-xl border border-neutral-800 text-neutral-500 py-3 text-[12px] font-semibold disabled:opacity-40"
        >
          {s.stato === "sospeso" ? "RIATTIVA SOCIO" : "SOSPENDI SOCIO"}
        </button>
      )}
    </div>
  );
}

function Requisito({ icona: Icona, nome, ok, valore, azione, aperto, children }) {
  return (
    <Card className={ok ? "" : "border-amber-900/50 bg-amber-950/10"}>
      <div className="flex items-center gap-3">
        <Icona size={16} className={ok ? "text-neutral-500" : "text-amber-400/70"} strokeWidth={1.8} />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-neutral-200">{nome}</div>
          <div className={`text-[11px] mt-0.5 truncate ${ok ? "text-neutral-500" : "text-amber-300/70"}`}>
            {valore}
          </div>
        </div>
        {ok
          ? <Check size={14} className="text-neutral-600 shrink-0" strokeWidth={2.5} />
          : <AlertTriangle size={14} className="text-amber-400/70 shrink-0" />}
        {azione && (
          <button
            onClick={azione}
            className="shrink-0 text-[11px] font-semibold text-neutral-300 border border-neutral-700 rounded-full px-3 py-1"
          >
            {aperto ? "Chiudi" : "Registra"}
          </button>
        )}
      </div>
      {aperto && <div className="mt-4 pt-4 border-t border-neutral-800">{children}</div>}
    </Card>
  );
}

function FormCertificato({ onSalva, lavoro }) {
  const [data, setData] = useState(() => piuGiorni(oggiIso(), 365));
  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] text-neutral-500">
        Data di scadenza riportata sul certificato
      </label>
      <input
        type="date"
        value={data}
        min={oggiIso()}
        onChange={(e) => setData(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 outline-none focus:border-neutral-600"
      />
      <p className="text-[10.5px] text-neutral-600 leading-relaxed">
        In app resta solo la data. Il cartaceo va conservato in reception.
      </p>
      <Bottone carica={lavoro} disabled={!data} onClick={() => onSalva(data)}>
        SALVA
      </Bottone>
    </div>
  );
}

function FormQuota({ onSalva, lavoro }) {
  const anno = stagioneCorrente();
  const [importo, setImporto] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] text-neutral-500">
        Stagione {anno - 1}/{anno}, chiude il 31 agosto {anno}
      </label>
      <div className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 focus-within:border-neutral-600">
        <span className="text-neutral-600 text-[14px]">€</span>
        <input
          type="number"
          name="importo-quota"
          autoComplete="off"
          inputMode="decimal"
          step="0.01"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          placeholder="Importo versato"
          className="flex-1 min-w-0 bg-transparent py-3 text-[14px] text-neutral-50 placeholder:text-neutral-600 outline-none"
        />
      </div>
      <Bottone
        carica={lavoro}
        disabled={!importo}
        onClick={() => onSalva(anno, Number(importo))}
      >
        REGISTRA QUOTA
      </Bottone>
    </div>
  );
}

function FormAbbonamento({ pacchetti, onSalva, lavoro }) {
  const [scelto, setScelto] = useState("");
  const [inizio, setInizio] = useState(oggiIso());
  const [pagato, setPagato] = useState(true);

  const pacchetto = pacchetti.find((p) => p.id === scelto);

  return (
    <div className="flex flex-col gap-3">
      <select
        value={scelto}
        onChange={(e) => setScelto(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 outline-none appearance-none focus:border-neutral-600"
      >
        <option value="">Scegli il pacchetto</option>
        {pacchetti.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome} — € {Number(p.prezzo).toFixed(2)}
          </option>
        ))}
      </select>

      <div>
        <label className="text-[11px] text-neutral-500 block mb-1.5">Comincia il</label>
        <input
          type="date"
          value={inizio}
          onChange={(e) => setInizio(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-3 text-[14px] text-neutral-50 outline-none focus:border-neutral-600"
        />
      </div>

      <label className="flex items-center gap-2.5 text-[12px] text-neutral-400">
        <input
          type="checkbox"
          checked={pagato}
          onChange={(e) => setPagato(e.target.checked)}
          className="w-4 h-4 accent-neutral-200"
        />
        Già pagato
      </label>

      {pacchetto && (
        <p className="text-[10.5px] text-neutral-600 leading-relaxed">
          {pacchetto.mesi} {pacchetto.mesi === 1 ? "mese" : "mesi"}
          {pacchetto.ingressi ? ` · ${pacchetto.ingressi} ingressi` : " · ingressi illimitati"}
          {pacchetto.include_classi ? " · classi incluse" : " · solo Open Box"}
        </p>
      )}

      <Bottone
        carica={lavoro}
        disabled={!pacchetto}
        onClick={() => onSalva(pacchetto, inizio, pagato)}
      >
        ATTIVA ABBONAMENTO
      </Bottone>
    </div>
  );
}

function Dato({ icona: Icona, valore }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Icona size={14} className="text-neutral-600 shrink-0" />
      <div className="text-[12.5px] text-neutral-300 truncate">{valore}</div>
    </div>
  );
}

function leggibile(e) {
  const m = String(e?.message || "");
  if (m.includes("duplicate key") && m.includes("quote")) {
    return "La quota di questa stagione risulta già versata.";
  }
  if (m.includes("row-level security") || m.includes("Solo il titolare")) {
    return "Non hai il permesso per questa operazione.";
  }
  if (m.includes("reception")) return m;
  return "Qualcosa non ha funzionato. Riprova fra poco.";
}
