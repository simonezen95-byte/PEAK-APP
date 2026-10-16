-- ============================================================
-- PEAK Functional Fitness — non interrompere la serie
--
-- Sulla home del socio c'è la fiamma con le settimane di fila. Chi
-- è a sette settimane e sta per perderle merita che qualcuno glielo
-- dica mentre c'è ancora tempo, non dopo.
--
-- ------------------------------------------------------------
-- QUESTA NOTIFICA È DIVERSA DALLE ALTRE, E VA TRATTATA DIVERSAMENTE
--
-- Le altre cinque danno un'informazione che il socio vuole: la
-- lezione è saltata, l'abbonamento scade. Questa è una spinta.
--
-- È legittima, ma è anche il tipo di avviso che diventa fastidioso
-- in fretta, e chi lo trova fastidioso non spegne quello: spegne
-- tutte le notifiche, e perde pure quelle utili. Per questo tre
-- paletti, scritti qui e non lasciati al buon senso:
--
--   1. una volta a settimana e basta, mai due;
--   2. solo a chi ha una serie vera da perdere — due settimane di
--      fila almeno. A chi non si allena da un mese non si dice
--      "non interrompere la serie": non ne ha una, e sarebbe una
--      presa in giro;
--   3. solo a chi può davvero allenarsi: certificato valido, quota
--      versata, abbonamento in corso. Spingere in palestra uno che
--      alla porta verrebbe fermato è peggio che tacere.
--
-- E un gruppo tutto suo, così chi la trova inutile spegne questa e
-- tiene le altre.
--
-- ------------------------------------------------------------
-- QUANDO
--
-- Giovedì mattina.
--
-- La settimana finisce la domenica, ma la domenica è chiusa e il
-- sabato ci viene poca gente: i giorni veri per rimediare sono
-- giovedì e venerdì. Chi a mercoledì sera non si è ancora fatto
-- vedere ha saltato tre giorni, e giovedì mattina è l'ultimo
-- momento in cui l'avviso serve ancora a qualcosa invece di
-- arrivare a cose fatte.
--
-- Mandarlo prima — lunedì, martedì — sarebbe assillo: uno che si
-- allena il giovedì non ha fatto niente di male il martedì.
--
-- Da eseguire dopo gli altri trentadue file.
-- ============================================================


-- ============================================================
-- 1. IL GRUPPO
-- ============================================================

insert into push_gruppi (gruppo, esce, urgenza, descrizione) values
  ('serie', true, 'normal',
   'Settimana quasi finita e nessun allenamento, con una serie in corso.')
on conflict (gruppo) do nothing;


-- ============================================================
-- 2. CHI STA PER PERDERE LA SERIE
--
-- Quante settimane di fila, senza contare quella in corso.
--
-- Non si ripercorre settimana per settimana come fa la fiamma: si
-- cerca l'ultima settimana VUOTA e si conta quanto c'è dopo. Lo
-- stesso risultato con una domanda sola invece di un giro per ogni
-- settimana e per ogni socio.
--
-- Si guarda indietro un anno: oltre, una serie interrotta e ripresa
-- non è più la stessa storia.
-- ============================================================

create or replace function serie_a_rischio()
returns table (profilo_id uuid, settimane int)
language sql
stable
security definer
set search_path = public
as $$
  with
  -- Le 52 settimane prima di quella in corso, dalla più vecchia.
  settimane as (
    select generate_series(
      date_trunc('week', current_date)::date - 52 * 7,
      date_trunc('week', current_date)::date - 7,
      interval '7 days'
    )::date as inizio
  ),
  -- Chi potrebbe allenarsi oggi, se volesse. Le stesse tre
  -- condizioni che l'app controlla alla prenotazione.
  in_regola as (
    select p.id
    from profili p
    where p.stato = 'approvato'
      and p.certificato_scadenza >= current_date
      and exists (
        select 1 from quote q
        where q.profilo_id = p.id
          and make_date(q.anno_sportivo, 8, 31) >= current_date
      )
      and exists (
        select 1 from abbonamenti a
        where a.profilo_id = p.id
          and a.tipo = 'abbonamento'
          and a.pagato
          and current_date between a.inizio and a.fine
      )
  ),
  -- Chi questa settimana non si è ancora fatto vedere.
  fermi_adesso as (
    select r.id
    from in_regola r
    where not exists (
      select 1 from prenotazioni p
      join sessioni s on s.id = p.sessione_id
      where p.profilo_id = r.id
        and p.stato in ('prenotato', 'presente')
        and s.data >= date_trunc('week', current_date)::date
    )
  ),
  -- L'ultima settimana in cui non si è allenato. Da lì in poi è
  -- tutta serie.
  ultimo_buco as (
    select f.id,
           max(s.inizio) filter (
             where not exists (
               select 1 from prenotazioni p
               join sessioni ss on ss.id = p.sessione_id
               where p.profilo_id = f.id
                 and p.stato in ('prenotato', 'presente')
                 and ss.data >= s.inizio
                 and ss.data < s.inizio + 7
             )
           ) as buco
    from fermi_adesso f
    cross join settimane s
    group by f.id
  )
  select
    u.id,
    (
      -- Dal buco alla settimana scorsa, in settimane. Se non c'è
      -- nessun buco si è allenato tutte e 52.
      case
        when u.buco is null then 52
        else ((date_trunc('week', current_date)::date - 7) - u.buco) / 7
      end
    )::int
  from ultimo_buco u
  where case
          when u.buco is null then 52
          else ((date_trunc('week', current_date)::date - 7) - u.buco) / 7
        end >= 2;
$$;

revoke all on function serie_a_rischio() from public, anon, authenticated;

comment on function serie_a_rischio() is
  'Chi ha una serie di almeno due settimane e questa settimana non '
  'si è ancora allenato, fra quelli che potrebbero allenarsi.';


-- ============================================================
-- 3. L'AVVISO
--
-- Il testo dice il numero. "Sei a sette settimane" vale molto più
-- di "non perdere la serie": è una cosa che la persona ha costruito
-- lei, e vedersela nominata è metà del motivo per cui funziona.
-- ============================================================

create or replace function avvisi_serie()
returns int
language sql
volatile
security definer
set search_path = public
as $$
  with candidati as (
    select * from serie_a_rischio()
  ),
  nuovi as (
    insert into avvisi_mandati (chiave, profilo_id)
    select 'serie:' || profilo_id || ':' || date_trunc('week', current_date)::date,
           profilo_id
    from candidati
    on conflict (chiave) do nothing
    returning chiave
  ),
  da_mandare as (
    select c.* from candidati c
    join nuovi n
      on n.chiave = 'serie:' || c.profilo_id || ':'
                 || date_trunc('week', current_date)::date
  ),
  scritte as (
    insert into notifiche (profilo_id, gruppo, titolo, testo)
    select profilo_id, 'serie',
           'Sei a ' || settimane || ' settimane di fila',
           -- Sabato e non domenica: la settimana finisce la
           -- domenica, ma di domenica è chiuso, e dire a qualcuno
           -- che ha tempo fino a un giorno in cui non può venire
           -- non è dargli tempo.
           --
           -- Corto apposta. Sullo schermo bloccato il testo viene
           -- tagliato dopo due righe, e tagliato dalla fine: una
           -- firma in coda a un testo lungo è la prima cosa che
           -- sparisce. Lo slogan sta qui solo perché il resto è
           -- stato accorciato per fargli posto.
           --
           -- E sta solo su questa notifica. Su "lezione annullata"
           -- uno slogan sarebbe fuori luogo: lì la persona ha un
           -- problema, non ha bisogno del marchio.
           'Non ti sei ancora allenato, hai tempo fino a sabato. '
             || 'Find your peak.'
    from da_mandare
    returning 1
  )
  select count(*)::int from scritte;
$$;

revoke all on function avvisi_serie() from public, anon, authenticated;


-- ============================================================
-- 4. L'OROLOGIO — giovedì alle 10
-- ============================================================

select cron.unschedule('peak-serie')
where exists (select 1 from cron.job where jobname = 'peak-serie');

select cron.schedule(
  'peak-serie',
  '0 10 * * 4',               -- 4 = giovedì
  $$select avvisi_serie()$$
);


-- ============================================================
-- 5. CONTROLLO
--
-- Dice chi la riceverebbe se partisse adesso, senza mandarla.
-- ============================================================

select
  (select count(*) from cron.job where jobname like 'peak-%')
    as lavori_programmati,
  (select count(*) from serie_a_rischio())
    as la_riceverebbero_adesso;
