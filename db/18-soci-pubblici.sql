-- ============================================================
-- PEAK Functional Fitness — chi può vedere l'elenco dei soci
--
-- Supabase segnala la vista `soci_pubblici` come SECURITY DEFINER:
-- una vista che legge coi permessi di chi l'ha creata, scavalcando le
-- regole sulla tabella `profili`.
--
-- La segnalazione è giusta, e quel comportamento è voluto. Serve
-- perché un socio deve poter leggere il nome di chi è iscritto alla
-- sua stessa classe, mentre su `profili` ognuno vede solo la propria
-- riga. Le regole di PostgreSQL funzionano per riga, non per colonna:
-- non c'è modo di dire "di questa riga puoi vedere il nome ma non il
-- telefono". La vista è esattamente quel modo.
--
-- La cura che suggerisce il pannello — security_invoker — qui
-- romperebbe l'app: provata, fa passare un socio approvato da sette
-- righe a una, e nelle classi comparirebbe "Socio" al posto dei nomi.
--
-- ------------------------------------------------------------
-- IL BUCO VERO, che la segnalazione ha fatto trovare.
--
-- La vista chiedeva solo di essere nel box giusto, non di essere
-- stati approvati. Chiunque si registrasse — e la registrazione è
-- aperta a tutti — poteva leggere subito nome e foto di ogni socio,
-- prima ancora che la reception lo approvasse.
--
-- Adesso chiede l'approvazione, come ogni altra regola del database.
--
-- Da eseguire dopo gli altri diciassette file.
-- ============================================================

create or replace view soci_pubblici as
  select id, box_id, nome, cognome, foto_url
  from profili
  where stato = 'approvato'
    and box_id = mio_box()
    and sono_approvato();

comment on view soci_pubblici is
  'Scheda ridotta visibile ai soci approvati del box: solo nome e '
  'foto. La vista scavalca di proposito le regole su profili, perché '
  'le regole di PostgreSQL valgono per riga e non per colonna, e qui '
  'serve mostrare una colonna sì e una no. Espone solo campi non '
  'sensibili, è filtrata sul box di chi guarda, e chiede che chi '
  'guarda sia a sua volta approvato. Non metterle security_invoker: '
  'la svuoterebbe, e nelle classi sparirebbero i nomi.';

grant select on soci_pubblici to authenticated;


-- ============================================================
-- CONTROLLO
--
-- Da eseguire da soci: un approvato deve vedere tutti, uno in attesa
-- nessuno. Qui si vede solo che la vista risponde.
-- ============================================================

select 'soci pubblici' as cosa, count(*) as righe from soci_pubblici;
