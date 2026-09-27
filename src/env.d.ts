/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd.supabase.co. Optional: cloud save is off without it. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon (public) key. Safe to ship: row-level security protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
