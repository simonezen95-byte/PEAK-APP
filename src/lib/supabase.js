import { createClient } from "@supabase/supabase-js";

// Le due chiavi arrivano dall'ambiente, non sono scritte nel codice:
// in locale dal file .env, in produzione dalle impostazioni di Vercel.
// La chiave "anon" è pubblica per natura — finisce comunque nel
// browser di chi usa l'app. A proteggere i dati sono le regole del
// database, non il fatto che la chiave sia segreta.
const url = import.meta.env.VITE_SUPABASE_URL;
const chiave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configurato = Boolean(url && chiave);

export const supabase = configurato
  ? createClient(url, chiave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
