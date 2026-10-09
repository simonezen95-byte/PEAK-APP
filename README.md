# App PEAK

App dei soci e console dello staff. React + Vite, database su Supabase.

## Com'è fatta

```
src/
  lib/supabase.js    collegamento al database
  lib/sessione.jsx   chi sta usando l'app adesso
  ui/base.jsx        campi, bottoni, spunte comuni
  schermate/         una schermata per file
  App.jsx            decide quale schermata mostrare
```

## Per farla funzionare

Servono due chiavi, che si trovano su Supabase in
**Project Settings → API**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

In locale si mettono in un file `.env` (vedi `.env.example`),
in produzione fra le variabili d'ambiente di Vercel.

## Database

Gli archivi e le regole stanno in `db/`, da eseguire in ordine:

1. `01-schema.sql` — gli archivi
2. `02-sicurezza.sql` — chi può leggere e scrivere cosa
3. `03-dati-iniziali.sql` — palestra, palinsesto, pacchetti, esercizi
4. `04-registrazione.sql` — serve alla creazione degli account

## Impostazione richiesta su Supabase

In **Authentication → Sign In / Providers → Email**, la conferma
dell'indirizzo via email va **spenta**. Il controllo vero è
l'approvazione dell'admin in reception: lasciandola accesa il socio
resterebbe senza scheda finché non clicca il link.
