-- ============================================================
-- PEAK Functional Fitness — le classi vuote non si confermano
--
-- Il palinsesto genera ogni classe prevista, anche quella dove non si
-- è iscritto nessuno. Prima dell'apertura sono quasi tutte così, e
-- l'elenco delle presenze da confermare diventava una lista
-- chilometrica di lezioni vuote da aprire una per una.
--
-- Una classe dove nessuno si è prenotato non ha presenze da
-- registrare: niente da confermare, niente da mostrare. Resta
-- raggiungibile dal calendario, se serve aggiungere qualcuno che si è
-- presentato senza prenotare.
--
-- Da eseguire dopo gli altri quattordici file.
-- ============================================================

create or replace function classi_da_chiudere(quanti_giorni int default 7)
returns table (
  sessione_id uuid,
  data        date,
  ora         time,
  nome        text,
  coach       text,
  iscritti    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.data, s.ora, s.nome,
    nullif(trim(coalesce(c.nome, '') || ' ' || coalesce(c.cognome, '')), ''),
    n.quanti
  from sessioni s
  left join profili c on c.id = s.coach_id
  cross join lateral (
    -- Chi occupava un posto. Le disdette non contano: se si sono
    -- disdetti tutti, la classe non si è tenuta. Nemmeno la lista
    -- d'attesa: in coda ci si finisce solo quando i posti sono
    -- pieni, quindi se c'è una coda c'è anche qualcuno dentro.
    select count(*)::int as quanti
    from prenotazioni p
    where p.sessione_id = s.id
      and p.stato = 'prenotato'
  ) n
  where s.box_id = mio_box()
    and s.tipo = 'classe'
    and not s.annullata
    and s.presenze_confermate_il is null
    and n.quanti > 0
    and inizio_sessione(s.data, s.ora) <= now()
    and s.data >= current_date - greatest(1, least(quanti_giorni, 60))
    and ho_permesso('cl_attendance')
    and (s.coach_id = auth.uid() or ho_permesso('cl_edit'))
  order by s.data desc, s.ora desc;
$$;

revoke all on function classi_da_chiudere(int) from public;
grant execute on function classi_da_chiudere(int) to authenticated;


-- ============================================================
-- CONTROLLO
--
-- Il numero che compare in cima alla home: devono essere solo le
-- classi con qualcuno dentro.
-- ============================================================

select 'classi da chiudere' as cosa, count(*) as quante from classi_da_chiudere();
