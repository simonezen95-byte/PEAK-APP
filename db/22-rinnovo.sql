-- ============================================================
-- PEAK Functional Fitness — un rinnovo registrato in anticipo
--
-- Difetto trovato con l'elenco delle scadenze davanti: chi rinnovava
-- qualche giorno prima della scadenza restava comunque in elenco, con
-- scritto che gli stava per scadere l'abbonamento. Sbagliato, e
-- fastidioso: è la lista delle telefonate da fare, e ci sarebbe
-- rimasta gente che aveva già pagato.
--
-- ------------------------------------------------------------
-- COSA SBAGLIAVO
--
-- Chiedevo: "esiste un abbonamento che COMINCIA dopo la fine di
-- questo?". È vero solo se il socio aspetta l'ultimo giorno per
-- rinnovare. Chi rinnova con cinque giorni di anticipo ha il nuovo
-- che parte prima che finisca il vecchio, e la domanda rispondeva no.
--
-- La domanda giusta è un'altra, e più semplice: "esiste un
-- abbonamento pagato che ARRIVA PIÙ IN LÀ di questo?". Se c'è, questa
-- non è una scadenza da richiamare, è una riga vecchia — che si
-- sovrapponga o no non cambia niente.
--
-- Da eseguire dopo gli altri ventuno file.
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
    -- Se ha già pagato un anno successivo, questa non è una scadenza:
    -- è una riga vecchia.
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
    -- Ha già rinnovato: esiste un abbonamento pagato che arriva più
    -- in là di questo. Che si sovrapponga o no non conta — e conta
    -- eccome che non contasse prima, perché rinnovare qualche giorno
    -- prima della scadenza è il modo normale di rinnovare.
    and not exists (select 1 from abbonamenti a2
                     where a2.profilo_id = a.profilo_id
                       and a2.tipo = 'abbonamento'
                       and a2.pagato
                       and a2.fine > a.fine)
  )
  select * from tutte order by quando;
$$;

revoke all on function scadenze_prossime(int) from public;
grant execute on function scadenze_prossime(int) to authenticated;


-- ============================================================
-- CONTROLLO
-- ============================================================

select count(*) as quante_scadenze from scadenze_prossime(30);
