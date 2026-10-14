-- ============================================================
-- PEAK Functional Fitness — la composizione del parco abbonamenti
--
-- Serve al grafico a torta della schermata Economia: di quello che si
-- è venduto in un periodo, che fetta è ciascun pacchetto.
--
-- ------------------------------------------------------------
-- IL PERIODO ADESSO SI CONTA IN GIORNI
--
-- Prima la funzione prendeva un numero di mesi e partiva dall'inizio
-- del mese: comoda per l'andamento mese per mese, inutile per "ultimi
-- 30 giorni". Adesso prende i giorni, e la schermata offre 30, 60,
-- 90, 180 e 365.
--
-- ------------------------------------------------------------
-- PERCHÉ "VENDUTI" E NON "ATTIVI"
--
-- Un conto di cosa è attivo adesso è una fotografia: non cambia se
-- guardi 30 o 365 giorni, e un selettore di periodo sopra non
-- avrebbe senso. Quello che cambia col periodo è cosa è stato
-- venduto dentro quel periodo, ed è anche la domanda utile: in questi
-- tre mesi la gente cosa ha scelto?
--
-- Quanti ne sono in corso adesso resta nella colonna "attivi", che
-- l'elenco sotto il grafico continua a mostrare.
--
-- Da eseguire dopo gli altri venticinque file.
-- ============================================================

drop function if exists economia_per_pacchetto(int);

create function economia_per_pacchetto(giorni int default 365)
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
   and a.inizio >= current_date - coalesce(giorni, 365)
   and exists (select 1 from profili p
                where p.id = a.profilo_id and p.box_id = mio_box())
  where k.box_id = mio_box()
    and k.tipo = 'abbonamento'
    and ho_permesso('abb_view')
  group by k.id, k.nome, k.prezzo, k.attivo
  -- Prima quelli che vendono. Un listino si legge dall'alto, e il
  -- grafico disegna le fette in quest'ordine: così la posizione
  -- nell'anello corrisponde alla posizione nella legenda, e si può
  -- riconoscere una fetta anche senza distinguerne il colore.
  order by count(a.id) desc, k.prezzo desc;
$$;

revoke all on function economia_per_pacchetto(int) from public;
grant execute on function economia_per_pacchetto(int) to authenticated;


-- ============================================================
-- CONTROLLO
-- ============================================================

select pacchetto, venduti, valore, attivi
from economia_per_pacchetto(90);
