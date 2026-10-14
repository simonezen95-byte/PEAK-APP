-- ============================================================
-- PEAK Functional Fitness — analisi: lo stato dei soci
--
-- La home resta la fotografia di oggi. Questa è la stanza dove si
-- scava, e si comincia dalle persone: chi c'è, chi si è fermato, a
-- chi sta scadendo qualcosa.
--
-- ------------------------------------------------------------
-- PERCHÉ SI COMINCIA DA QUI E NON DALLE TENDENZE
--
-- I grafici dell'andamento hanno bisogno di mesi di dati per dire
-- qualcosa di vero. Lo stato dei soci invece è utile dal primo
-- giorno, e risponde alle due domande che costano soldi: chi sta per
-- smettere, e a chi devo chiedere un rinnovo.
--
-- ------------------------------------------------------------
-- UNA SCELTA IMPORTANTE: "FERMO" SI MISURA DALLE PRESENZE
--
-- Non dalle prenotazioni. Chi prenota e non si presenta non si è
-- allenato, e sarebbe il peggiore dei falsi tranquilli: la lista
-- direbbe che va tutto bene proprio per quelli che stanno smettendo.
-- Per questo conta solo quello che il coach ha confermato.
--
-- ------------------------------------------------------------
-- L'ORDINE DEL FILE
--
-- Prima le due liste, poi i numeri che le riassumono. I numeri in
-- testa alla schermata sono contati chiedendo alle liste, non con una
-- copia della stessa regola: una regola scritta due volte è una
-- regola che prima o poi diverge, e il numero in grande direbbe una
-- cosa e la lista sotto un'altra.
--
-- Da eseguire dopo gli altri diciannove file.
-- ============================================================


-- ============================================================
-- 1. L'ULTIMA VOLTA CHE È VENUTO
-- ============================================================

create or replace function ultima_presenza(socio uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select max(s.data)
  from prenotazioni p
  join sessioni s on s.id = p.sessione_id
  where p.profilo_id = socio
    and p.stato = 'presente';
$$;

comment on function ultima_presenza(uuid) is
  'La data dell''ultimo allenamento confermato dal coach. Null se non '
  'si è mai allenato. Le prenotazioni non contano: chi prenota e non '
  'si presenta non si è allenato.';

revoke all on function ultima_presenza(uuid) from public;
grant execute on function ultima_presenza(uuid) to authenticated;


-- ============================================================
-- 2. CHI SI È FERMATO
--
-- La lista che vale di più. Un socio che paga e non viene più è un
-- socio che a scadenza non rinnova, e lo si scopre con tre mesi di
-- ritardo se nessuno guarda.
--
-- In cima i peggiori: non per fare classifiche, ma perché la
-- telefonata si fa a quelli, e una lista si legge dall'alto.
-- ============================================================

drop function if exists soci_fermi(int);

create function soci_fermi(settimane int default 3)
returns table (
  id               uuid,
  nome             text,
  cognome          text,
  email            text,
  telefono         text,
  foto_url         text,
  ultima           date,
  giorni_fermo     int,
  mai_venuto       boolean,
  abbonamento      text,
  abbonamento_fine date,
  paga_e_non_viene boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nome, p.cognome, p.email, p.telefono, p.foto_url,
    u.ultima,
    (current_date - coalesce(u.ultima, p.iscritto_il::date))::int,
    u.ultima is null,
    k.nome,
    a.fine,
    -- Il caso che brucia: l'abbonamento è attivo e pagato, i soldi
    -- sono entrati, e la persona non si vede. Qui una telefonata
    -- recupera ancora qualcosa.
    a.id is not null
  from profili p
  cross join lateral (select ultima_presenza(p.id) as ultima) u
  left join lateral (
    select * from abbonamenti x
    where x.profilo_id = p.id
      and x.tipo = 'abbonamento'
      and x.pagato
      and current_date between x.inizio and x.fine
    order by x.fine desc
    limit 1
  ) a on true
  left join pacchetti k on k.id = a.pacchetto_id
  where p.box_id = mio_box()
    and p.stato = 'approvato'
    -- Solo i soci. Io e i coach siamo schede approvate come le altre,
    -- ma questa lista serve a fare telefonate: vedersi dentro il
    -- titolare "fermo da tre settimane" non aiuta nessuno, e con
    -- quattro soci di partenza falserebbe tutti i numeri.
    and p.ruolo = 'socio'
    and ho_permesso('soci_view')
    -- Chi si è iscritto la settimana scorsa e non è ancora venuto non
    -- è fermo: non ha ancora avuto tempo. Per questo chi non si è mai
    -- allenato si misura dal giorno dell'iscrizione.
    and coalesce(u.ultima, p.iscritto_il::date)
          < current_date - (coalesce(settimane, 3) * 7)
  order by
    -- Prima chi paga e non viene, poi per quanto tempo è passato.
    (a.id is not null) desc,
    coalesce(u.ultima, p.iscritto_il::date);
$$;

revoke all on function soci_fermi(int) from public;
grant execute on function soci_fermi(int) to authenticated;


-- ============================================================
-- 3. COSA STA SCADENDO
--
-- Tre cose scadono e fermano un socio: il certificato medico, la
-- quota annuale e l'abbonamento. Sono tre tabelle diverse, ma per chi
-- sta in segreteria sono una cosa sola: un elenco di telefonate da
-- fare in ordine di data.
--
-- Ci sta dentro anche quello che è scaduto da poco, perché è lì che
-- serve guardare: uno scaduto ieri è ancora recuperabile, e se la
-- lista mostrasse solo il futuro sparirebbe proprio il giorno in cui
-- diventa urgente.
--
-- Qui dentro ci stanno anche io e i coach, al contrario della lista
-- di chi si è fermato. Il motivo è semplice: un coach col certificato
-- medico scaduto è un problema più grosso di un socio col certificato
-- scaduto, non più piccolo.
-- ============================================================

drop function if exists scadenze_prossime(int);

create function scadenze_prossime(giorni int default 30)
returns table (
  profilo_id uuid,
  nome       text,
  cognome    text,
  email      text,
  telefono   text,
  genere     text,
  cosa       text,
  quando     date,
  giorni_a   int,
  scaduta    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with finestra as (
    select (current_date - 14) as da,
           (current_date + coalesce(giorni, 30)) as a,
           ho_permesso('soci_view') as posso
  ),
  -- Le tre scadenze messe in fila. Stanno dentro un contenitore con
  -- i nomi delle colonne scritti a mano perché l'ordinamento in fondo
  -- deve poter dire "per data" e non "per la settima colonna":
  -- aggiungere una colonna in mezzo cambierebbe il numero, e
  -- l'ordinamento diventerebbe sbagliato senza che niente si lamenti.
  tutte (profilo_id, nome, cognome, email, telefono,
         genere, cosa, quando, giorni_a, scaduta) as (

  -- Certificato medico
  select p.id, p.nome, p.cognome, p.email, p.telefono,
         'certificato', 'Certificato medico',
         p.certificato_scadenza,
         (p.certificato_scadenza - current_date)::int,
         p.certificato_scadenza < current_date
  from profili p, finestra f
  where f.posso
    and p.box_id = mio_box()
    and p.stato = 'approvato'
    and p.certificato_scadenza between f.da and f.a

  union all

  -- Quota annuale: scade col 31 agosto dell'anno sportivo
  select p.id, p.nome, p.cognome, p.email, p.telefono,
         'quota',
         'Quota ' || q.anno_sportivo || '/' || (q.anno_sportivo + 1),
         make_date(q.anno_sportivo, 8, 31),
         (make_date(q.anno_sportivo, 8, 31) - current_date)::int,
         make_date(q.anno_sportivo, 8, 31) < current_date
  from quote q
  join profili p on p.id = q.profilo_id
  cross join finestra f
  where f.posso
    and p.box_id = mio_box()
    and p.stato = 'approvato'
    and make_date(q.anno_sportivo, 8, 31) between f.da and f.a
    -- Se ha già pagato l'anno dopo, questa non è una scadenza: è una
    -- riga vecchia.
    and not exists (select 1 from quote q2
                     where q2.profilo_id = q.profilo_id
                       and q2.anno_sportivo > q.anno_sportivo)

  union all

  -- Abbonamento
  select p.id, p.nome, p.cognome, p.email, p.telefono,
         'abbonamento', coalesce(k.nome, 'Abbonamento'),
         a.fine,
         (a.fine - current_date)::int,
         a.fine < current_date
  from abbonamenti a
  join profili p on p.id = a.profilo_id
  left join pacchetti k on k.id = a.pacchetto_id
  cross join finestra f
  where f.posso
    and p.box_id = mio_box()
    and p.stato = 'approvato'
    and a.tipo = 'abbonamento'
    and a.pagato
    and a.fine between f.da and f.a
    -- Se ne ha già uno che parte dopo non è una scadenza: ha
    -- rinnovato.
    and not exists (select 1 from abbonamenti a2
                     where a2.profilo_id = a.profilo_id
                       and a2.tipo = 'abbonamento'
                       and a2.pagato
                       and a2.inizio > a.fine)
  )
  select * from tutte order by quando;
$$;

revoke all on function scadenze_prossime(int) from public;
grant execute on function scadenze_prossime(int) to authenticated;


-- ============================================================
-- 4. I NUMERI IN TESTA ALLA SCHERMATA
--
-- Sei numeri, scelti perché ognuno fa fare qualcosa. "Quanti soci in
-- totale" non fa fare niente, e non c'è.
--
-- Non c'è "soci in regola": quello sta già sulla home, e averlo in
-- due schermate vorrebbe dire due conti da tenere d'accordo per
-- sempre. Qui ci sta solo quello che la home non dice.
--
-- ------------------------------------------------------------
-- I PRIMI TRE NUMERI STANNO IN PIEDI DA SOLI: attivi + fermi +
-- appena arrivati fa esattamente il totale dei soci, sempre.
--
-- Sembra un dettaglio e non lo è. Se "attivi negli ultimi 30 giorni"
-- e "fermi da 3 settimane" usassero due misure diverse, con dieci
-- soci si leggerebbe "6 attivi e 5 fermi" e la schermata perderebbe
-- credibilità in un secondo. Perciò la soglia è una sola, e i tre
-- gruppi non si sovrappongono: ogni socio sta in uno e uno solo.
--
--   attivi          si è allenato nelle ultime 3 settimane
--   fermi           non si allena da più di 3 settimane
--   appena_arrivati iscritto da meno di 3 settimane, non ancora
--                   venuto: non è fermo, è da seguire
-- ============================================================

drop function if exists analisi_soci();
drop function if exists analisi_soci(int);
drop function if exists analisi_soci(int, int);

-- Prende le stesse finestre delle due liste, e non per capriccio:
-- nella schermata si possono allargare, e se i numeri grandi
-- restassero fermi le liste si accorcerebbero mentre i numeri non si
-- muovono. Due cose che dicono il falso insieme.
create function analisi_soci(settimane int default 3,
                             giorni int default 30)
returns table (
  soci            int,  -- le schede socio vive, senza staff
  attivi          int,  -- si sono allenati davvero, di recente
  fermi           int,  -- da richiamare
  appena_arrivati int,  -- iscritti da poco e non ancora venuti
  mai_venuti      int,  -- fra i fermi, quelli mai entrati in classe
  scadenze        int,  -- cose che scadono nella finestra scelta
  prove_del_mese  int   -- quante persone sono venute a provare
)
language sql
stable
security definer
set search_path = public
as $$
  with soci as (
    select p.id, p.iscritto_il::date as iscritto,
           ultima_presenza(p.id) as ultima
    from profili p
    where p.box_id = mio_box()
      and p.stato = 'approvato'
      and p.ruolo = 'socio'
  ),
  soglia as (
    select (current_date - (coalesce(settimane, 3) * 7)) as g
  )
  select
    (select count(*)::int from soci),

    (select count(*)::int from soci, soglia
      where ultima >= soglia.g),

    -- Fermi e mai venuti li chiede alla lista, non li riconta: così
    -- il numero grande e la lista sotto non possono raccontare due
    -- storie diverse.
    (select count(*)::int from soci_fermi(settimane)),

    (select count(*)::int from soci, soglia
      where ultima is null and iscritto >= soglia.g),

    (select count(*)::int from soci_fermi(settimane) where mai_venuto),

    (select count(*)::int from scadenze_prossime(giorni)),

    (select quante_prove(date_trunc('month', current_date)::date,
                         current_date))
  where ho_permesso('soci_view');
$$;

revoke all on function analisi_soci(int, int) from public;
grant execute on function analisi_soci(int, int) to authenticated;


-- ============================================================
-- 5. CONTROLLO
-- ============================================================

select * from analisi_soci(3, 30);
