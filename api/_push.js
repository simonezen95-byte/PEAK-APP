/* La cifratura delle notifiche push, scritta a mano.

   Una notifica push non si spedisce in chiaro: il servizio che la
   recapita — Google per Android, Apple per iPhone — non deve poterla
   leggere. Si cifra con una chiave che conoscono solo il nostro
   server e quel telefono.

   La procedura è definita da due standard, RFC 8291 per la cifratura
   e RFC 8292 per la firma, ed è fatta di passaggi precisi in cui un
   errore non dà errore: dà una notifica che il telefono scarta in
   silenzio. Per questo ogni passaggio qui sotto è verificato contro
   l'esempio pubblicato nello standard — vedi lo script di prova.

   Niente libreria esterna. Non per gusto: la libreria si sarebbe
   dovuta pubblicare senza poterla provare, e qui l'errore non si
   vede. Questa invece gira anche sul banco di prova, e i valori
   intermedi si confrontano uno per uno con quelli dello standard. */

import crypto from "node:crypto";

const b64 = (b) => Buffer.from(b).toString("base64url");
const daB64 = (s) => Buffer.from(s, "base64url");

/** HMAC-SHA-256, il mattone di tutta la derivazione. */
function hmac(chiave, dati) {
  return crypto.createHmac("sha256", chiave).update(dati).digest();
}

/** Un passo di HKDF: dalla chiave e da un'etichetta esce una chiave
    nuova. Il byte 0x01 in coda è il contatore del primo blocco. */
function derivaCon(prk, info, quanti) {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, quanti);
}

/** Un'etichetta: testo ASCII seguito da uno zero. */
function etichetta(testo) {
  return Buffer.concat([Buffer.from(testo, "ascii"), Buffer.from([0])]);
}

/* ----------------------------------------------------------------
   Le chiavi: dalla coppia nostra e da quella del telefono si arriva
   alla chiave con cui si cifra. Questa è la parte che lo standard
   descrive passo per passo, e che la prova verifica tutta.
   ---------------------------------------------------------------- */

export function chiaviDiSessione({ p256dh, auth, nostraPrivata, nostraPubblica, sale }) {
  const suaPubblica = daB64(p256dh);
  const segretoAuth = daB64(auth);

  // Il segreto condiviso: lo calcolano uguale noi e il telefono,
  // ciascuno con la propria chiave privata e la pubblica dell'altro,
  // senza che passi mai in rete.
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(nostraPrivata);
  const condiviso = ecdh.computeSecret(suaPubblica);

  // Il segreto condiviso da solo non basta: ci si mescola il segreto
  // di autenticazione, che è noto solo a noi e a quel telefono. Senza,
  // chiunque intercettasse le due chiavi pubbliche potrebbe leggere.
  const prkChiave = hmac(segretoAuth, condiviso);

  // Nell'etichetta entrano tutt'e due le chiavi pubbliche, nell'ordine
  // telefono-poi-noi. Invertirle produce una chiave diversa e una
  // notifica che il telefono scarta.
  const infoChiave = Buffer.concat([
    etichetta("WebPush: info"),
    suaPubblica,
    nostraPubblica,
  ]);
  const ikm = derivaCon(prkChiave, infoChiave, 32);

  const prk = hmac(sale, ikm);
  const cek = derivaCon(prk, etichetta("Content-Encoding: aes128gcm"), 16);
  const nonce = derivaCon(prk, etichetta("Content-Encoding: nonce"), 12);

  return { condiviso, prkChiave, ikm, prk, cek, nonce };
}

/* ----------------------------------------------------------------
   Il corpo del messaggio
   ---------------------------------------------------------------- */

/** Cifra il testo per un telefono. Torna i byte da spedire. */
export function cifra(testo, { p256dh, auth }, saleDato = null) {
  // Una coppia di chiavi nuova per ogni messaggio: così due notifiche
  // allo stesso telefono non condividono niente.
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const nostraPrivata = ecdh.getPrivateKey();
  const nostraPubblica = ecdh.getPublicKey();

  const sale = saleDato ?? crypto.randomBytes(16);

  const { cek, nonce } = chiaviDiSessione({
    p256dh, auth, nostraPrivata, nostraPubblica, sale,
  });

  // Lo standard vuole un byte 0x02 dopo il testo: segna dove finisce
  // il messaggio e dove comincia il riempimento, che qui non c'è.
  const dentro = Buffer.concat([
    Buffer.from(testo, "utf8"),
    Buffer.from([2]),
  ]);

  const cifratore = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const cifrato = Buffer.concat([
    cifratore.update(dentro),
    cifratore.final(),
    cifratore.getAuthTag(),
  ]);

  // L'intestazione viaggia in chiaro davanti al messaggio: il sale,
  // la dimensione del blocco, e la nostra chiave pubblica di questo
  // messaggio — senza quella il telefono non può decifrare.
  const dimensione = Buffer.alloc(4);
  dimensione.writeUInt32BE(4096, 0);

  return Buffer.concat([
    sale,
    dimensione,
    Buffer.from([nostraPubblica.length]),
    nostraPubblica,
    cifrato,
  ]);
}

/* ----------------------------------------------------------------
   La firma: dice al servizio di recapito che siamo noi
   ---------------------------------------------------------------- */

/** Il lasciapassare da mettere nell'intestazione della richiesta.
    Vale poche ore e si rifà ogni volta: non c'è niente da salvare. */
export function lasciapassare(endpoint, chiavePrivata, chiavePubblica, contatto) {
  const { origin } = new URL(endpoint);

  const testa = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const corpo = b64(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 11 * 3600,
    sub: contatto,
  }));
  const daFirmare = Buffer.from(`${testa}.${corpo}`, "ascii");

  // La chiave privata è 32 byte grezzi; per firmare va vestita da
  // chiave vera. Si costruisce come JWK, che è la via più corta.
  const chiave = crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64(chiavePrivata),
      x: b64(chiavePubblica.subarray(1, 33)),
      y: b64(chiavePubblica.subarray(33, 65)),
    },
    format: "jwk",
  });

  // La firma va in formato "due numeri attaccati", non nel formato
  // con cui OpenSSL la produce di suo.
  const firma = crypto.sign("sha256", daFirmare, {
    key: chiave,
    dsaEncoding: "ieee-p1363",
  });

  return {
    Authorization: `vapid t=${testa}.${corpo}.${b64(firma)}, k=${b64(chiavePubblica)}`,
  };
}

/* ----------------------------------------------------------------
   Spedire
   ---------------------------------------------------------------- */

/** Manda una notifica a un telefono.

    Torna com'è andata. Il 404 e il 410 sono i due casi che contano:
    vogliono dire che quell'iscrizione non esiste più — app
    disinstallata, permesso revocato — e che va tolta dal database,
    altrimenti si continua a spedire nel vuoto per sempre. */
export async function spedisci(telefono, messaggio, chiavi) {
  const corpo = cifra(JSON.stringify(messaggio), telefono);
  const privata = daB64(chiavi.privata);
  const pubblica = daB64(chiavi.pubblica);

  const r = await fetch(telefono.endpoint, {
    method: "POST",
    headers: {
      ...lasciapassare(telefono.endpoint, privata, pubblica, chiavi.contatto),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: messaggio.urgenza || "normal",
    },
    body: corpo,
  });

  return {
    ok: r.ok,
    stato: r.status,
    sparito: r.status === 404 || r.status === 410,
    testo: r.ok ? "" : (await r.text().catch(() => "")).slice(0, 300),
  };
}
