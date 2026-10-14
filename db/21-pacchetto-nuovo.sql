-- ============================================================
-- PEAK Functional Fitness — creare un pacchetto nuovo
--
-- Un difetto trovato provando a creare un abbonamento omaggio: il
-- listino si poteva modificare ma non si poteva aggiungere niente, e
-- l'app rispondeva "non hai il permesso" anche al titolare.
--
-- ------------------------------------------------------------
-- COSA SUCCEDEVA
--
-- Ogni riga del listino porta scritto a quale palestra appartiene.
-- Modificando un pacchetto che c'era già, quel dato era dentro la
-- riga e tutto funzionava. Creandone uno nuovo invece l'app non lo
-- scriveva, e la regola di sicurezza — che chiede "questa riga è
-- della TUA palestra?" — si trovava davanti un vuoto e rispondeva no.
--
-- Il permesso non c'entrava niente: il messaggio era fuorviante.
--
-- ------------------------------------------------------------
-- PERCHÉ SI RIPARA QUI E NON NELL'APP
--
-- Si poteva far scrivere la palestra all'app. Ma allora ogni
-- programma che un domani scrivesse nel listino dovrebbe ricordarsi
-- di farlo, e chi se ne dimentica rivede lo stesso messaggio
-- sbagliato. Meglio che sia il database a saperlo: se non gliela
-- dici, mette la tua.
--
-- La protezione non si allenta di un millimetro. La regola che
-- controlla "è della tua palestra?" resta identica: continua a
-- rifiutare chi provasse a scrivere nel listino di un'altra.
--
-- Da eseguire dopo gli altri venti file.
-- ============================================================

alter table pacchetti
  alter column box_id set default mio_box();

comment on column pacchetti.box_id is
  'La palestra a cui appartiene il pacchetto. Se non viene scritta la '
  'mette il database, prendendo quella di chi sta scrivendo: senza, '
  'la regola di sicurezza rifiuterebbe la riga con un messaggio che '
  'parla di permessi e manda fuori strada.';


-- ============================================================
-- CONTROLLO
--
-- Deve stampare la riga appena creata, e poi sparire: è una prova,
-- non un pacchetto vero.
-- ============================================================

do $$
declare
  nuovo uuid;
  quale uuid;
begin
  if mio_box() is null then
    raise notice 'Prova saltata: qui non sei collegato come persona. '
                 'Normale nell''editor di Supabase.';
    return;
  end if;

  insert into pacchetti (nome, tipo, prezzo, mesi, include_classi)
  values ('Prova di controllo', 'abbonamento', 0, 1, true)
  returning id, box_id into nuovo, quale;

  raise notice 'Creato senza indicare la palestra, e il database ha '
               'messo: %', quale;

  delete from pacchetti where id = nuovo;
  raise notice 'Prova cancellata. Tutto a posto.';
end $$;
