import { createClient } from "@supabase/supabase-js";
import { readConfig } from "./config";

const { supabaseUrl, supabaseAnonKey } = readConfig();

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

if (import.meta.env.DEV) {
  const g = globalThis as any;
  if (!g.__imageopzSupabaseEnvLogged) {
    g.__imageopzSupabaseEnvLogged = true;
    // eslint-disable-next-line no-console
    console.log("[imageopz] Supabase enabled:", supabaseEnabled);
    // eslint-disable-next-line no-console
    console.log("[imageopz] VITE_SUPABASE_URL:", supabaseUrl || "");
    // eslint-disable-next-line no-console
    console.log("[imageopz] VITE_SUPABASE_ANON_KEY length:", supabaseAnonKey.length);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist is ok, but the app controls when to actually *use* the token for backend calls
    // (restore-only / claimed-account mode) to avoid breaking guest flows.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
