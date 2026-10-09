-- ============================================================
-- PEAK Functional Fitness — un pezzo che serve alla registrazione
--
-- Il problema: chi si sta registrando non ha ancora una scheda
-- socio, e senza scheda non può leggere l'elenco delle palestre.
-- Ma per creare la scheda deve sapere a quale palestra iscriversi.
--
-- La soluzione: questa funzione, che risponde solo "qual è la
-- palestra" e nient'altro. Non apre l'archivio, dà un codice.
--
-- Da eseguire dopo gli altri tre file.
-- ============================================================

create or replace function box_di_default()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from boxes order by creato_il limit 1;
$$;

revoke all on function box_di_default() from public;
grant execute on function box_di_default() to authenticated;


-- Controllo
select 'palestra di default' as cosa, box_di_default() as codice;
