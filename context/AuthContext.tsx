import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { readConfig } from "@/lib/config";
import posthog from 'posthog-js';

type AuthContextValue = {
  loadingAuth: boolean;
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  email: string | null;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Unconfigured (dev only; production shows the config screen): signed out, nothing to listen to.
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }
    const client = supabase;
    let mounted = true;
    (async () => {
      const { data } = await client.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoadingAuth(false);
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoadingAuth(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
    }
    const redirectTo =
      readConfig().supabaseRedirectUrl || `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        // Option A: allow auto-create on claim flow. Backend still enforces Pro on restore/me.
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
    posthog.capture('magic_link_requested', { email });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    posthog.capture('user_signed_out');
    posthog.reset();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const accessToken = session?.access_token ?? null;
    const email = (user?.email ?? null) as string | null;
    return {
      loadingAuth,
      user,
      session,
      accessToken,
      email,
      signInWithMagicLink,
      signOut,
    };
  }, [loadingAuth, user, session, signInWithMagicLink, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
