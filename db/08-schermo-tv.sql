-- ============================================================
-- PEAK Functional Fitness — un indirizzo corto per lo schermo
--
-- Il codice lungo resta e continua a funzionare. Accanto si può
-- tenere una parola breve, perché digitare 32 caratteri con un
-- telecomando è una pena.
--
-- Non è un buco: quella pagina mostra il WOD del giorno e nient'altro
-- — nessun archivio, nessun dato dei soci — ed è la stessa cosa
-- scritta sulla lavagna in sala. Indovinarla non dà niente che non sia
-- già appeso al muro.
--
-- Da eseguire dopo gli altri sette file.
-- ============================================================

alter table boxes
  add column if not exists tv_alias text unique;

comment on column boxes.tv_alias is
  'Parola breve per lo schermo in sala, alternativa a tv_token. '
  'Esempio: con ''peak'' vale /tv/peak.';


-- La funzione accetta ora tutti e due: il codice lungo e la parola.
create or replace function wod_per_tv(codice text, giorno date default current_date)
returns table (
  box_nome text,
  data date,
  titolo text,
  tipo_score tipo_score,
  time_cap text,
  warm_up text,
  varianti jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select b.nome, w.data, w.titolo, w.tipo_score, w.time_cap, w.warm_up,
         coalesce(
           (select jsonb_object_agg(v.variante, v.testo)
              from wod_varianti v where v.wod_id = w.id),
           '{}'::jsonb)
  from boxes b
  left join wod w on w.box_id = b.id and w.data = giorno
  where b.tv_token = codice
     or b.tv_alias = lower(codice);
$$;

revoke all on function wod_per_tv(text, date) from public;
grant execute on function wod_per_tv(text, date) to anon, authenticated;


-- La parola scelta per PEAK.
update boxes set tv_alias = 'peak'
where nome = 'PEAK Functional Fitness A.S.D.'
  and tv_alias is null;


-- ============================================================
-- CONTROLLO
-- ============================================================

select 'peak-app-weld.vercel.app/tv/' || tv_alias as indirizzo_corto,
       'peak-app-weld.vercel.app/tv/' || tv_token as indirizzo_lungo
from boxes;
