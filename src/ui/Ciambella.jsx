/* Il grafico a torta, disegnato a mano.

   Nessuna libreria: una fetta è un arco, e un arco sono due righe di
   matematica. Una libreria di grafici qui vorrebbe dire centinaia di
   chili da scaricare — su un telefono in palestra, con la rete della
   palestra — per disegnare sei spicchi.

   Tre cose che tengono in piedi il grafico anche per chi non
   distingue bene i colori, e che quindi non sono decorazioni:

   1. Le fette vanno dalla più grande alla più piccola in senso
      orario, partendo da mezzogiorno, e la legenda segue lo stesso
      ordine. La terza voce è la terza fetta.
   2. La percentuale è scritta dentro la fetta, quando c'è posto.
   3. Nel buco in mezzo c'è il totale, che è il numero che dà senso a
      tutte le percentuali.

   Il filo scuro fra una fetta e l'altra è dello stesso colore dello
   sfondo: separa due fette vicine anche quando i colori si
   somigliano. */

const R = 86;      // raggio esterno
const BUCO = 54;   // raggio del buco
const MISURA = 200;
const C = MISURA / 2;

function punto(angolo, raggio) {
  const a = (angolo - 90) * Math.PI / 180;
  return [C + raggio * Math.cos(a), C + raggio * Math.sin(a)];
}

function spicchio(da, a) {
  const grande = a - da > 180 ? 1 : 0;
  const [xe1, ye1] = punto(da, R);
  const [xe2, ye2] = punto(a, R);
  const [xi2, yi2] = punto(a, BUCO);
  const [xi1, yi1] = punto(da, BUCO);
  return [
    `M${xe1.toFixed(2)},${ye1.toFixed(2)}`,
    `A${R},${R} 0 ${grande},1 ${xe2.toFixed(2)},${ye2.toFixed(2)}`,
    `L${xi2.toFixed(2)},${yi2.toFixed(2)}`,
    `A${BUCO},${BUCO} 0 ${grande},0 ${xi1.toFixed(2)},${yi1.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export default function Ciambella({ pezzi, totale, sotto }) {
  if (!pezzi || pezzi.length === 0) return null;

  // Una fetta sola: un anello intero, perché un arco da 360 gradi non
  // si può disegnare con un arco solo e verrebbe un cerchio vuoto.
  const unica = pezzi.length === 1;

  let angolo = 0;
  const archi = pezzi.map((p) => {
    const da = angolo;
    const a = angolo + p.quota * 360;
    angolo = a;
    return { ...p, da, a, meta: (da + a) / 2 };
  });

  return (
    /* Anello sopra, legenda sotto a tutta larghezza.

       Affiancati ci stavano, ma i nomi dei pacchetti sono lunghi —
       "Mensile 2 a settimana" — e su un telefono venivano tagliati a
       metà. Un nome tagliato in una legenda è una legenda rotta: è lì
       proprio per dire quale fetta è quale. */
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${MISURA} ${MISURA}`}
        className="w-[164px] h-[164px] shrink-0"
        role="img"
        aria-label={`Composizione: ${pezzi
          .map((p) => `${p.nome} ${Math.round(p.quota * 100)}%`)
          .join(", ")}`}
      >
        {unica ? (
          <circle
            cx={C} cy={C} r={(R + BUCO) / 2}
            fill="none"
            stroke={archi[0].colore}
            strokeWidth={R - BUCO}
          />
        ) : (
          archi.map((p) => (
            <path
              key={p.nome}
              d={spicchio(p.da, p.a)}
              fill={p.colore}
              stroke="#171717"
              strokeWidth="2"
            />
          ))
        )}

        {/* La percentuale dentro la fetta, solo dove ci sta davvero.
            Sotto una certa larghezza il numero uscirebbe dai bordi e
            finirebbe sopra quello della fetta accanto. */}
        {archi.map((p) =>
          p.quota >= 0.11 ? (
            <text
              key={`n-${p.nome}`}
              x={punto(p.meta, (R + BUCO) / 2)[0]}
              y={punto(p.meta, (R + BUCO) / 2)[1] + 3.5}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#171717"
            >
              {Math.round(p.quota * 100)}%
            </text>
          ) : null
        )}

        <text
          x={C} y={C - 1} textAnchor="middle"
          fontSize="22" fontWeight="700" fill="#fafafa"
          className="font-display"
        >
          {totale}
        </text>
        <text
          x={C} y={C + 13} textAnchor="middle"
          fontSize="9" fill="#8A8A8A" letterSpacing="1"
        >
          {sotto}
        </text>
      </svg>

      <Legenda pezzi={pezzi} />
    </div>
  );
}

function Legenda({ pezzi }) {
  return (
    <div className="w-full flex flex-col gap-2">
      {pezzi.map((p) => (
        <div key={p.nome} className="flex items-center gap-2 text-[11px]">
          <span
            style={{ background: p.colore }}
            className="w-2.5 h-2.5 rounded-[3px] shrink-0"
          />
          <span
            className={`truncate ${p.resto ? "text-dettaglio" : "text-neutral-300"}`}
          >
            {p.nome}
          </span>
          <span className="ml-auto pl-3 text-dettaglio tabular-nums shrink-0">
            {p.quanti}
          </span>
          <span className="w-10 text-right text-neutral-100 font-semibold tabular-nums shrink-0">
            {Math.round(p.quota * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
