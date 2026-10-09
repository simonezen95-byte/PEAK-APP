-- ============================================================
-- PEAK Functional Fitness — dati iniziali
--
-- Riempie il database con quello che esiste già nella realtà:
-- la palestra, il palinsesto settimanale, i pacchetti in vendita
-- e la libreria degli esercizi.
--
-- Si può rieseguire senza fare danni: quello che c'è già viene
-- saltato, non duplicato.
--
-- Da eseguire dopo 01-schema.sql e 02-sicurezza.sql.
-- ============================================================


-- ============================================================
-- 1. LA PALESTRA
-- ============================================================

insert into boxes (nome, indirizzo, cap, comune, provincia, telefono, email, piva, codice_fiscale)
select 'PEAK Functional Fitness A.S.D.',
       'Via Enrico Mattei 18', '31010', 'Maser', 'TV',
       '+39 393 765 2236',
       'info.peakfunctionalfitness@gmail.com',
       '05641970263', '05641970263'
where not exists (select 1 from boxes where nome = 'PEAK Functional Fitness A.S.D.');


-- ============================================================
-- 2. PALINSESTO SETTIMANALE
--
-- Classi da 60 minuti, 15 posti:
--   lun/mer/ven  06:30 · 12:45 · 17:30 · 18:30 · 19:30
--   mar/gio      12:45 · 17:30 · 18:30 · 19:30
--   sabato       10:30 · 11:30
--
-- Open Box a fasce da un'ora, 10 posti:
--   lun–ven      08:00–14:00 e 17:00–21:00
--   sabato       10:00–13:00
--
-- Domenica chiuso.
-- ============================================================

with peak as (
  select id from boxes where nome = 'PEAK Functional Fitness A.S.D.'
),
classi as (
  -- lunedì, mercoledì, venerdì
  select g.giorno, o.ora
  from unnest(array[1,3,5]) as g(giorno)
  cross join unnest(array['06:30','12:45','17:30','18:30','19:30']::time[]) as o(ora)
  union all
  -- martedì, giovedì
  select g.giorno, o.ora
  from unnest(array[2,4]) as g(giorno)
  cross join unnest(array['12:45','17:30','18:30','19:30']::time[]) as o(ora)
  union all
  -- sabato
  select 6, o.ora
  from unnest(array['10:30','11:30']::time[]) as o(ora)
)
insert into palinsesto (box_id, giorno, ora, tipo, nome, capienza)
select peak.id, classi.giorno, classi.ora, 'classe', 'Functional', 15
from peak, classi
on conflict do nothing;

with peak as (
  select id from boxes where nome = 'PEAK Functional Fitness A.S.D.'
),
fasce as (
  -- feriali: mattina fino alle 14 (la classe delle 12:45 finisce
  -- alle 13:45), pomeriggio dalle 17 alle 21
  select g.giorno, make_time(h.ora, 0, 0) as ora
  from unnest(array[1,2,3,4,5]) as g(giorno)
  cross join unnest(array[8,9,10,11,12,13,17,18,19,20]) as h(ora)
  union all
  -- sabato: solo mattina, chiude alle 13
  select 6, make_time(h.ora, 0, 0)
  from unnest(array[10,11,12]) as h(ora)
)
insert into palinsesto (box_id, giorno, ora, tipo, nome, capienza)
select peak.id, fasce.giorno, fasce.ora, 'openbox', 'Open Box', 10
from peak, fasce
on conflict do nothing;


-- ============================================================
-- 3. PACCHETTI
--
-- ATTENZIONE: i prezzi qui sotto sono quelli di prova del
-- prototipo, non ancora decisi. Vanno rivisti sulla concorrenza
-- locale e sui costi fissi prima dell'apertura. Si cambiano
-- dalla sezione Abbonamenti, senza toccare questo file.
-- ============================================================

with peak as (
  select id from boxes where nome = 'PEAK Functional Fitness A.S.D.'
),
catalogo (nome, tipo, prezzo, mesi, ingressi, include_classi, sessioni) as (values
  ('Mensile libero',        'abbonamento',  70.00,  1, null::int, true,  null::int),
  ('Mensile 12 ingressi',   'abbonamento',  60.00,  1, 12,        true,  null),
  ('Mensile 8 ingressi',    'abbonamento',  50.00,  1, 8,         true,  null),
  ('Trimestrale',           'abbonamento', 195.00,  3, null,      true,  null),
  ('Semestrale',            'abbonamento', 360.00,  6, null,      true,  null),
  ('Annuale',               'abbonamento', 660.00, 12, null,      true,  null),
  ('Solo Open Box',         'abbonamento',  45.00,  1, null,      false, null),
  ('Primo mese di prova',   'abbonamento',  50.00,  1, null,      true,  null),
  ('Personal · singola',    'personal',     45.00,  3, null,      true,  1),
  ('Personal · 5 sessioni', 'personal',    200.00,  6, null,      true,  5),
  ('Personal · 10 sessioni','personal',    380.00, 12, null,      true,  10)
)
insert into pacchetti (box_id, nome, tipo, prezzo, mesi, ingressi, include_classi, sessioni)
select peak.id, c.nome, c.tipo::tipo_pacchetto, c.prezzo, c.mesi, c.ingressi, c.include_classi, c.sessioni
from peak, catalogo c
where not exists (
  select 1 from pacchetti p where p.box_id = peak.id and p.nome = c.nome
);


-- ============================================================
-- 4. LIBRERIA ESERCIZI
--
-- Senza palestra assegnata: è la lista di base, uguale per tutti.
-- I soci possono aggiungerne altri dall'app, e quelli restano
-- legati al loro box.
-- ============================================================

insert into esercizi (box_id, nome, categoria)
select null, nome, categoria
from (values
  ('Snatch','Sollevamento olimpico'),
  ('Power Snatch','Sollevamento olimpico'),
  ('Hang Snatch','Sollevamento olimpico'),
  ('Squat Snatch','Sollevamento olimpico'),
  ('Muscle Snatch','Sollevamento olimpico'),
  ('Clean','Sollevamento olimpico'),
  ('Power Clean','Sollevamento olimpico'),
  ('Hang Clean','Sollevamento olimpico'),
  ('Squat Clean','Sollevamento olimpico'),
  ('Muscle Clean','Sollevamento olimpico'),
  ('Clean & Jerk','Sollevamento olimpico'),
  ('Jerk','Sollevamento olimpico'),
  ('Push Jerk','Sollevamento olimpico'),
  ('Split Jerk','Sollevamento olimpico'),

  ('Back Squat','Squat e gambe'),
  ('Front Squat','Squat e gambe'),
  ('Overhead Squat','Squat e gambe'),
  ('Box Squat','Squat e gambe'),
  ('Pause Squat','Squat e gambe'),
  ('Bulgarian Split Squat','Squat e gambe'),
  ('Pistol Squat','Squat e gambe'),
  ('Lunge con bilanciere','Squat e gambe'),

  ('Deadlift','Tirate'),
  ('Sumo Deadlift','Tirate'),
  ('Romanian Deadlift','Tirate'),
  ('Deficit Deadlift','Tirate'),
  ('Snatch Pull','Tirate'),
  ('Clean Pull','Tirate'),
  ('Rack Pull','Tirate'),

  ('Bench Press','Spinte'),
  ('Incline Bench Press','Spinte'),
  ('Close Grip Bench','Spinte'),
  ('Strict Press','Spinte'),
  ('Push Press','Spinte'),
  ('Thruster','Spinte'),
  ('Dip zavorrato','Spinte'),

  ('Pull Up zavorrato','Ginnastica'),
  ('Chin Up zavorrato','Ginnastica'),
  ('Muscle Up','Ginnastica'),
  ('Handstand Push Up','Ginnastica'),
  ('Ring Dip zavorrato','Ginnastica'),
  ('Rope Climb','Ginnastica'),
  ('Toes to Bar','Ginnastica'),

  ('Barbell Row','Accessori'),
  ('Pendlay Row','Accessori'),
  ('Good Morning','Accessori'),
  ('Hip Thrust','Accessori'),
  ('Farmer Walk','Accessori'),
  ('Turkish Get Up','Accessori')
) as e(nome, categoria)
on conflict do nothing;


-- ============================================================
-- 5. CONTROLLO
-- Esegui e verifica che i numeri tornino.
-- ============================================================

select 'palestre'  as archivio, count(*) as righe from boxes
union all select 'classi a settimana',  count(*) from palinsesto where tipo = 'classe'
union all select 'fasce Open Box',      count(*) from palinsesto where tipo = 'openbox'
union all select 'pacchetti',           count(*) from pacchetti
union all select 'esercizi',            count(*) from esercizi;
