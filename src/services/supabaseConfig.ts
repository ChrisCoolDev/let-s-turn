// Configuration Supabase pour passer du mode local/multi-onglets au vrai multijoueur distant.
// Pour l'activer :
// 1. Crée un projet gratuit sur https://supabase.com et active "Anonymous Sign-Ins" dans Auth > Providers.
// 2. Exécute supabase/schema.sql dans le SQL Editor de Supabase.
// 3. Installe @supabase/supabase-js (`npm install @supabase/supabase-js`) et définis dans .env.local :
//    VITE_SUPABASE_URL="https://xxxx.supabase.co"
//    VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."

export interface SupabaseEnvConfig {
  url: string | undefined;
  anonKey: string | undefined;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseEnvConfig {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}
