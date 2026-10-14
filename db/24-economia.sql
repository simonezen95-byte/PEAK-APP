-- ============================================================
-- PEAK Functional Fitness — economia
--
-- Che aria tira, in soldi. Non è la contabilità dell'associazione e
-- non deve diventarlo: è il quadro di cosa portano gli abbonamenti e
-- le quote, che è la parte che l'app conosce davvero.
--
-- ------------------------------------------------------------
-- COSA QUESTI NUMERI SONO, E COSA NON SONO
--
-- L'app sa quanto costa a listino un pacchetto e sa chi ce l'ha.
-- Quindi sa calcolare quanto vale il parco abbonamenti. Quello che
-- NON sa è il denaro vero che entra in cassa: non ci passano i
-- pagamenti, non c'è nessun collegamento con la banca, e la spunta
-- "pagato" dice solo che qualcuno l'ha messa. Sconti fatti a voce,
-- rate, merchandising, contributi: niente di tutto questo si vede.
--
-- Il valore viene dal listino di OGGI. Se fra sei mesi il mensile
-- passa da 60 a 65, anche i mesi passati si rileggeranno a 65: il
-- prezzo venduto non viene fotografato nell'abbonamento, c'è solo il
-- collegamento al pacchetto. È un limite da sapere, perché rende i
-- confronti fra mesi lontani meno affidabili di quanto sembrino.
--
-- Perciò questi numeri servono a rispondere a domande come "il mese
-- prossimo scadono dodici abbonamenti, quanto vale rinnovarli?", e
-- non a quadrare un estratto conto.
--
-- ------------------------------------------------------------
-- UNA SCELTA: IL MESE È QUELLO IN CUI L'ABBONAMENTO COMINCIA
--
-- Un abbonamento di tre mesi non si spalma su tre mesi: conta tutto
-- nel mese in cui parte. È il momento in cui la persona ha deciso e
-- in cui normalmente paga. Spalmarlo darebbe un andamento più dolce e
-- meno utile: non si vedrebbe più il mese in cui sono entrate venti
-- persone nuove.
--
-- Da eseguire dopo gli altri ventitré file.
-- ============================================================


-- ============================================================
-- 1. IL PREZZO DI UN ABBONAMENTO
--
-- Sta scritto una volta sola perché serve dappertutto qui dentro, e
-- una regola copiata è una regola che prima o poi diverge.
-- ============================================================

create or replace function valore_abbonamento(abb uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(k.prezzo, 0)
  from abbonamenti a
  left join pacchetti k on k.id = a.pacchetto_id
  where a.id = abb;
$$;

comment on function valore_abbonamento(uuid) is
  'Quanto vale un abbonamento, al listino di oggi. Non è il prezzo '
  'davvero pagato: quello non viene conservato, e un cambio di '
  'listino riscrive anche il passato.';

revoke all on function valore_abbonamento(uuid) from public;
grant execute on function valore_abbonamento(uuid) to authenticated;


-- ============================================================
-- 2. I NUMERI IN TESTA
--
-- Sei, e ognuno risponde a una domanda che ci si fa davvero.
-- ============================================================

drop function if exists economia_riassunto();

create function economia_riassunto()
returns table (
  attivi_quanti     int,      -- abbonamenti in corso adesso
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
-- 3. MESE PER MESE
--
-- L'andamento vero: quanto è partito ogni mese. Gli ultimi dodici,
-- compresi quelli vuoti, perché un mese a zero è un'informazione e
-- saltarlo nasconderebbe proprio il buco.
-- ============================================================

drop function if exists economia_per_mese(int);

create function economia_per_mese(quanti_mesi int default 12)
returns table (
  mese          date,
  abbonamenti   numeric,
  quote         numeric,
  totale        numeric,
  quanti        int
)
language sql
stable
security definer
set search_path = public
as $$
  with mesi as (
    select generate_series(
      date_trunc('month', current_date)::date
        - ((coalesce(quanti_mesi, 12) - 1) || ' months')::interval,
      date_trunc('month', current_date)::date,
      '1 month'
    )::date as m
  )
  select
    mesi.m,
    coalesce((select sum(coalesce(k.prezzo, 0))
       from abbonamenti a
       join profili p on p.id = a.profilo_id
       left join pacchetti k on k.id = a.pacchetto_id
       where p.box_id = mio_box() and a.tipo = 'abbonamento' and a.pagato
         and date_trunc('month', a.inizio)::date = mesi.m), 0),
    coalesce((select sum(coalesce(q.importo, 0))
       from quote q join profili p on p.id = q.profilo_id
       where p.box_id = mio_box()
         and date_trunc('month', q.versata_il)::date = mesi.m), 0),
    coalesce((select sum(coalesce(k.prezzo, 0))
       from abbonamenti a
       join profili p on p.id = a.profilo_id
       left join pacchetti k on k.id = a.pacchetto_id
       where p.box_id = mio_box() and a.tipo = 'abbonamento' and a.pagato
         and date_trunc('month', a.inizio)::date = mesi.m), 0)
    + coalesce((select sum(coalesce(q.importo, 0))
       from quote q join profili p on p.id = q.profilo_id
       where p.box_id = mio_box()
         and date_trunc('month', q.versata_il)::date = mesi.m), 0),
    coalesce((select count(*)::int
       from abbonamenti a
       join profili p on p.id = a.profilo_id
       where p.box_id = mio_box() and a.tipo = 'abbonamento' and a.pagato
         and date_trunc('month', a.inizio)::date = mesi.m), 0)
  from mesi
  where ho_permesso('abb_view')
  order by mesi.m;
$$;

revoke all on function economia_per_mese(int) from public;
grant execute on function economia_per_mese(int) to authenticated;


-- ============================================================
-- 4. QUALE PACCHETTO TIRA
--
-- Serve a decidere il listino: quale formula sceglie la gente, e
-- quale è lì a fare numero. Un pacchetto che non vende nessuno è un
-- pacchetto da togliere o da ripensare.
-- ============================================================

drop function if exists economia_per_pacchetto(int);

create function economia_per_pacchetto(mesi_indietro int default 12)
returns table (
  pacchetto  text,
  prezzo     numeric,
  venduti    int,
  valore     numeric,
  attivi     int,     -- quanti sono in corso adesso
  spento     boolean  -- non più in vendita
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.nome, k.prezzo,
    count(a.id)::int,
    -- Solo quando un abbonamento c'è davvero. Senza questa
    -- precisazione un pacchetto mai venduto risultava valere il
    -- proprio prezzo: nel collegamento "tieni anche le righe senza
    -- nessuno" resta comunque una riga, e il prezzo del pacchetto ci
    -- sta sopra anche se non l'ha comprato nessuno.
    coalesce(sum(k.prezzo) filter (where a.id is not null), 0),
    count(a.id) filter (
      where current_date between a.inizio and a.fine
    )::int,
    not k.attivo
  from pacchetti k
  -- La data di partenza sta scritta qui dentro e non in un pezzo a
  -- parte: in un collegamento "tieni anche le righe senza nessuno"
  -- un pezzo a parte non si vede, e il conto salterebbe.
  left join abbonamenti a
    on a.pacchetto_id = k.id
   and a.pagato
   and a.inizio >= (date_trunc('month', current_date)
         - ((coalesce(mesi_indietro, 12) - 1) || ' months')::interval)::date
   and exists (select 1 from profili p
                where p.id = a.profilo_id and p.box_id = mio_box())
  where k.box_id = mio_box()
    and k.tipo = 'abbonamento'
    and ho_permesso('abb_view')
  group by k.id, k.nome, k.prezzo, k.attivo
  -- Prima quelli che vendono. Un listino si legge dall'alto.
  order by count(a.id) desc, k.prezzo desc;
$$;

revoke all on function economia_per_pacchetto(int) from public;
grant execute on function economia_per_pacchetto(int) to authenticated;


-- ============================================================
-- 5. CONTROLLO
-- ============================================================

select * from economia_riassunto();
