-- ============================================================
-- PEAK Functional Fitness — abbonamenti e persone non sono la stessa
-- cosa
--
-- Nella schermata Economia il primo riquadro diceva "31 persone"
-- contando gli abbonamenti in corso. Finché ogni persona ne ha uno
-- solo i due numeri coincidono e l'errore non si vede; appena
-- qualcuno ne ha due che si sovrappongono — un rinnovo registrato in
-- anticipo, un omaggio aggiunto sopra a uno attivo, una prova fatta
-- due volte — il conto resta giusto e la parola diventa falsa.
--
-- È saltato fuori subito, con due sole persone registrate e quattro
-- abbonamenti addosso. Meglio così: con quaranta soci nessuno se ne
-- sarebbe accorto.
--
-- Adesso i due numeri sono due, e la schermata può dire tutt'e due.
-- Quando non coincidono lo scrive, invece di scegliere quale dei due
-- raccontare.
--
-- Da eseguire dopo gli altri ventiquattro file.
-- ============================================================

drop function if exists economia_riassunto();

create function economia_riassunto()
returns table (
  attivi_quanti     int,      -- abbonamenti in corso adesso
  attivi_persone    int,      -- quante PERSONE stanno dietro a quegli
                              -- abbonamenti: non è lo stesso numero
  attivi_valore     numeric,  -- quanto vale il parco abbonamenti
  mese_valore       numeric,  -- partiti questo mese, abbonamenti + quote
  mese_quanti       int,
  scadenze_quanti   int,      -- scadono nei prossimi 30 giorni
  scadenze_valore   numeric,  -- quanto vale rinnovarli
  sospeso_quanti    int,      -- segnati non pagati
  sospeso_valore    numeric   -- promesso e non incassato
)
language sql
stable
security definer
set search_path = public
as $$
  with miei as (
    select a.*, coalesce(k.prezzo, 0) as prezzo
    from abbonamenti a
    join profili p on p.id = a.profilo_id
    left join pacchetti k on k.id = a.pacchetto_id
    where p.box_id = mio_box()
      and a.tipo = 'abbonamento'
  )
  select
    (select count(*)::int from miei
      where pagato and current_date between inizio and fine),

    (select count(distinct profilo_id)::int from miei
      where pagato and current_date between inizio and fine),

    (select coalesce(sum(prezzo), 0) from miei
      where pagato and current_date between inizio and fine),

    -- Questo mese: abbonamenti partiti, più le quote versate. La
    -- quota ha un importo suo, scritto quando la si registra, ed è
    -- l'unico numero qui dentro che è davvero il soldo incassato.
    (select coalesce(sum(prezzo), 0) from miei
       where pagato and inizio >= date_trunc('month', current_date)::date)
    + (select coalesce(sum(q.importo), 0)
       from quote q join profili p on p.id = q.profilo_id
       where p.box_id = mio_box()
         and q.versata_il >= date_trunc('month', current_date)::date),

    (select count(*)::int from miei
      where pagato and inizio >= date_trunc('month', current_date)::date),

    -- Scadono entro un mese e nessuno ha ancora rinnovato: è il
    -- lavoro da fare, non una perdita già avvenuta.
    (select count(*)::int from miei a
      where a.pagato
        and a.fine between current_date and current_date + 30
        and not exists (select 1 from miei b
                         where b.profilo_id = a.profilo_id
                           and b.pagato and b.fine > a.fine)),

    (select coalesce(sum(a.prezzo), 0) from miei a
      where a.pagato
        and a.fine between current_date and current_date + 30
        and not exists (select 1 from miei b
                         where b.profilo_id = a.profilo_id
                           and b.pagato and b.fine > a.fine)),

    -- Attivati senza spunta "pagato": qualcuno deve dei soldi, o si è
    -- dimenticato di segnare che sono arrivati. In entrambi i casi è
    -- una cosa da sistemare.
    (select count(*)::int from miei
      where not pagato and fine >= current_date),

    (select coalesce(sum(prezzo), 0) from miei
      where not pagato and fine >= current_date)

  where ho_permesso('abb_view');
$$;

revoke all on function economia_riassunto() from public;
grant execute on function economia_riassunto() to authenticated;


-- ============================================================
-- CONTROLLO
-- ============================================================

select * from economia_riassunto();
