/* Il speditore.

   È l'unico pezzo di PEAK che gira su un server. Fa una cosa sola:
   svuota la coda delle notifiche.

   Non decide niente — quali notifiche escano, a chi, con che urgenza
   lo decide il database. Qui si prende quello che c'è da spedire, si
   cifra, si manda, e si scrive com'è andata. Se domani cambiano le
   regole, cambia il database e questo file resta uguale.

   ------------------------------------------------------------
   PERCHÉ È PROTETTO DA UN SEGRETO

   Questo indirizzo è pubblico su internet: chiunque può provare a
   chiamarlo. Da solo non potrebbe fare danni veri — non accetta
   messaggi da fuori, spedisce solo quello che trova in coda — ma
   chiamato in continuazione svuoterebbe la coda a vuoto e
   consumerebbe il conto di Vercel. Il segreto tiene fuori il rumore.

   ------------------------------------------------------------
   COSA SERVE NELLE IMPOSTAZIONI DI VERCEL

     SUPABASE_URL           l'indirizzo del progetto
     SUPABASE_CHIAVE_SERVER la chiave di servizio (NON quella pubblica)
     VAPID_PUBBLICA         la chiave pubblica, la stessa dell'app
     VAPID_PRIVATA          la privata, che sta solo qui
     VAPID_CONTATTO         mailto:... per il servizio di recapito
     PUSH_SEGRETO           la parola d'ordine di questo indirizzo
*/

import { spedisci } from "./_push.js";

const QUANTE_PER_GIRO = 50;

async function rpc(nome, argomenti) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_CHIAVE_SERVER,
      Authorization: `Bearer ${process.env.SUPABASE_CHIAVE_SERVER}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(argomenti ?? {}),
  });
  if (!r.ok) {
    throw new Error(`${nome}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export default async function handler(req, res) {
  const atteso = process.env.PUSH_SEGRETO;
  if (!atteso) {
    return res.status(500).json({ errore: "PUSH_SEGRETO non impostato" });
  }
  if (req.headers["x-peak-segreto"] !== atteso) {
    // Volutamente avaro: a chi bussa senza parola d'ordine non si
    // dice nemmeno cosa c'è dietro la porta.
    return res.status(404).end();
  }

  const chiavi = {
    privata: process.env.VAPID_PRIVATA,
    pubblica: process.env.VAPID_PUBBLICA,
    contatto: process.env.VAPID_CONTATTO || "mailto:info@peakfunctionalfitness.it",
  };
  if (!chiavi.privata || !chiavi.pubblica) {
    return res.status(500).json({ errore: "chiavi VAPID non impostate" });
  }

  let righe;
  try {
    righe = await rpc("prossime_push", { quante: QUANTE_PER_GIRO });
  } catch (e) {
    return res.status(500).json({ errore: String(e.message) });
  }

  if (!righe || righe.length === 0) {
    return res.status(200).json({ spedite: 0, fallite: 0, spariti: 0 });
  }

  let spedite = 0, fallite = 0, spariti = 0;

  // Tutte insieme, non una dopo l'altra: sono chiamate verso
  // internet, e cinquanta in fila una alla volta sforerebbero il
  // tempo massimo di questa funzione. Ognuna si chiude da sé, quindi
  // una che fallisce non ferma le altre.
  await Promise.all(
    righe.map(async (r) => {
      let esito;
      try {
        esito = await spedisci(
          { endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
          {
            titolo: r.titolo,
            testo: r.testo,
            link: r.link,
            gruppo: r.gruppo,
            urgenza: r.urgenza,
          },
          chiavi
        );
      } catch (e) {
        esito = { ok: false, sparito: false, testo: String(e.message) };
      }

      if (esito.ok) spedite++;
      else if (esito.sparito) spariti++;
      else fallite++;

      try {
        await rpc("chiudi_push", {
          riga: r.id,
          andata_bene: esito.ok,
          sparito: esito.sparito,
          motivo: esito.testo || null,
        });
      } catch {
        /* Se non riusciamo a segnare l'esito la riga resta in coda e
           verrà ripresa: meglio una notifica doppia che una persa. */
      }
    })
  );

  return res.status(200).json({ spedite, fallite, spariti });
}
