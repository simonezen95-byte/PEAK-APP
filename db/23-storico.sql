-- ============================================================
-- PEAK Functional Fitness — lo storico del socio, rimesso a posto
--
-- Tre difetti, tutti nati dalla stessa riscrittura: quando ho
-- rifatto questa funzione per contare gli ingressi, mi sono portato
-- dietro solo le colonne che servivano a quello e ho perso le altre.
--
-- ------------------------------------------------------------
-- 1. "NON PAGATO" ADDOSSO A TUTTI
--
-- La funzione aveva smesso di dire se un abbonamento era pagato. La
-- schermata chiedeva quel dato, non lo trovava, e un dato che non
-- c'è vale come un no: l'etichetta si accendeva su ogni riga, anche
-- su quelle incassate da mesi.
--
-- 2. LO STORICO SENZA NOMI
--
-- La colonna col nome dell'abbonamento si chiamava "descrizione", e
-- io l'avevo ribattezzata "nome". La schermata continuava a cercare
-- "descrizione" e trovava il vuoto: righe con le date e nient'altro.
--
-- 3. UN BUCO NELLA PROTEZIONE
--
-- La funzione controllava anche che il socio fosse della propria
-- palestra, e quel controllo era sparito. Oggi di palestre ce n'è
-- una sola e non è successo niente, ma era una porta aperta: chi
-- avesse saputo l'identificativo di un socio di un altro box ne
-- avrebbe letto abbonamenti e quote.
--
-- ------------------------------------------------------------
-- E UNA COSA CHE MANCAVA: SEGNARE UN PAGAMENTO ARRIVATO DOPO
--
-- Si poteva attivare un abbonamento non pagato — "paga la settimana
-- prossima" — ma poi non c'era modo di dire che il pagamento era
-- arrivato. L'etichetta sarebbe rimasta lì per sempre.
--
-- Da eseguire dopo gli altri ventidue file.
-- ============================================================


-- ============================================================
-- 1. LO STORICO, COMPLETO
-- ============================================================

drop function if exists socio_storico(uuid);

create function socio_storico(socio uuid)
returns table (
  id          uuid,       -- l'abbonamento, per segnarne il pagamento
  genere      text,       -- 'quota' oppure 'abbonamento'
  descrizione text,
  dal         date,
  al          date,
  residui     int,
  totali      int,
  pagato      boolean,
  gratuito    boolean,
  quando      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, 'abbonamento', k.nome, a.inizio, a.fine,
         -- Gli ingressi si ricontano ogni volta dalle presenze, non
         -- si tengono da parte: una presenza corretta dal coach deve
         -- rimettere a posto anche il conteggio.
         ingressi_residui(a.id), a.totali,
         a.pagato,
         -- Un omaggio non è "pagato": è che non c'era niente da
         -- pagare. Detto così si legge per quello che è.
         coalesce(k.prezzo, 0) = 0,
         a.creato_il
  from abbonamenti a
  join pacchetti k on k.id = a.pacchetto_id
  join profili p on p.id = a.profilo_id
  where a.profilo_id = socio
    -- Il controllo che mancava: solo i soci della propria palestra.
    and p.box_id = mio_box()
    and ho_permesso('abb_view')

  union all

  -- Niente identificativo per le quote: serve solo a segnare un
  -- pagamento, e una quota che esiste è già pagata per definizione.
  select null::uuid, 'quota',
         'Quota ' || q.anno_sportivo || '/' || (q.anno_sportivo + 1),
         q.versata_il,
         make_date(q.anno_sportivo, 8, 31),
         null, null,
         -- Una quota esiste solo se è stata versata: se è lì, è
         -- pagata.
         true, false,
         q.versata_il::timestamptz
  from quote q
  join profili p on p.id = q.profilo_id
  where q.profilo_id = socio
    and p.box_id = mio_box()
    and ho_permesso('abb_view')

  -- Per numero d'ordine: una UNION non sa ordinare per nome di
  -- colonna. È la quarta, cioè la data di fine.
  order by 4 desc;
$$;

revoke all on function socio_storico(uuid) from public;
grant execute on function socio_storico(uuid) to authenticated;


-- ============================================================
-- 2. SEGNARE UN PAGAMENTO ARRIVATO DOPO
--
-- Si può anche tornare indietro, perché le mani sbagliano: se uno
-- segna pagato l'abbonamento di un'altra persona deve poterlo
-- disfare, senza cancellare e rifare tutto.
-- ============================================================

create or replace function segna_pagato(abb uuid, si boolean default true)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  quale uuid;
begin
  select p.box_id into quale
  from abbonamenti a
  join profili p on p.id = a.profilo_id
  where a.id = abb;

  if quale is null or quale <> mio_box() or not ho_permesso('abb_edit') then
    raise exception 'Non puoi modificare questo abbonamento.';
  end if;

  update abbonamenti set pagato = si where id = abb;
end;
$$;

revoke all on function segna_pagato(uuid, boolean) from public;
grant execute on function segna_pagato(uuid, boolean) to authenticated;


-- ============================================================
-- 3. CONTROLLO
-- ============================================================

select 'La funzione adesso restituisce:' as cosa,
       pg_get_function_result(oid) as colonne
from pg_proc where proname = 'socio_storico';
