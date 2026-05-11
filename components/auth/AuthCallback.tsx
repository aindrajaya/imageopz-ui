import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getSessionMe, restoreProSession, ImageOpzApiError } from "@/lib/imageopzApi";
import { supabase } from "@/lib/supabaseClient";
import posthog from 'posthog-js';

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function getSupabaseAccessTokenWithRetry(opts?: { maxWaitMs?: number; intervalMs?: number }) {
  const maxWaitMs = typeof opts?.maxWaitMs === "number" ? opts.maxWaitMs : 2_000;
  const intervalMs = typeof opts?.intervalMs === "number" ? opts.intervalMs : 100;
  const startedAt = Date.now();
  while (Date.now() - startedAt <= maxWaitMs) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) return token;
    await sleep(intervalMs);
  }
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}

export function AuthCallback() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const ranOnceRef = useRef(false);

  useEffect(() => {
    // React StrictMode in dev may run effects twice; protect against double-restore.
    if (ranOnceRef.current) return;
    ranOnceRef.current = true;

    (async () => {
      let didNavigate = false;
      const safeNavigate = (to: string) => {
        if (didNavigate) return;
        didNavigate = true;
        navigate(to, { replace: true });
      };
      try {
        // Be defensive: ensure Supabase session is established from URL (hash/code) before proceeding.
        // Some browsers may not trigger `detectSessionInUrl` fast enough.
        try {
          const url = new URL(window.location.href);
          const code = url.searchParams.get("code");
          if (code) {
            await supabase.auth.exchangeCodeForSession(window.location.href);
          } else if (window.location.hash) {
            const params = new URLSearchParams(window.location.hash.slice(1));
            const at = params.get("access_token");
            const rt = params.get("refresh_token");
            if (at && rt) {
              await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            }
          }
        } catch {
          // ignore
        }

        const tokenToUse = accessToken ?? (await getSupabaseAccessTokenWithRetry()) ?? null;
        let sessionId = localStorage.getItem("imageopz_session_id");
        if (!sessionId) {
          const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          try {
            localStorage.setItem("imageopz_session_id", id);
          } catch {}
          sessionId = id;
        }
        const restoreIntent = localStorage.getItem("imageopz_restore_intent") === "true";
        if (restoreIntent) {
          localStorage.removeItem("imageopz_restore_intent");
          const restoreEmail = localStorage.getItem("imageopz_restore_email");
          localStorage.removeItem("imageopz_restore_email");

          if (!tokenToUse || !restoreEmail) {
            try {
              localStorage.removeItem("imageopz_account_claimed");
            } catch {}
            safeNavigate("/?restore=not_pro");
            return;
          }

          // Backend may rate-limit; retry a few times with server hint.
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              await restoreProSession({ email: restoreEmail, sessionId, accessToken: tokenToUse });
              break;
            } catch (e) {
              const retryAfter =
                e instanceof ImageOpzApiError && e.status === 429
                  ? (typeof (e.payload?.details as any)?.retry_after_ms === "number"
                      ? (e.payload?.details as any).retry_after_ms
                      : 800 * (attempt + 1))
                  : null;
              if (retryAfter !== null && attempt < 3) {
                await sleep(Math.min(10_000, Math.max(300, retryAfter)));
                continue;
              }
               try {
                 localStorage.removeItem("imageopz_account_claimed");
               } catch {}
               safeNavigate("/?restore=not_pro");
               return;
             }
           }

           let me: Awaited<ReturnType<typeof getSessionMe>> | null = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              me = await getSessionMe({ sessionId, accessToken: tokenToUse });
              break;
            } catch (e) {
              const retryAfter =
                e instanceof ImageOpzApiError && e.status === 429
                  ? (typeof (e.payload?.details as any)?.retry_after_ms === "number"
                      ? (e.payload?.details as any).retry_after_ms
                      : 800 * (attempt + 1))
                  : null;
              if (retryAfter !== null && attempt < 3) {
                await sleep(Math.min(10_000, Math.max(300, retryAfter)));
                continue;
              }
              me = null;
              break;
            }
          }

           if (!me) {
             try {
               localStorage.removeItem("imageopz_account_claimed");
             } catch {}
             safeNavigate("/?restore=not_pro");
             return;
           }
           const proOk = Boolean(me.is_pro && me.pro_verified && !me.needs_restore);
           if (proOk) {
            localStorage.setItem("imageopz_account_claimed", "true");
            // Restore succeeded: clear "force restore" UI flags so Pro becomes active immediately.
            try {
              localStorage.removeItem("imageopz_force_restore");
              localStorage.removeItem("imageopz_hide_restore_cta");
            } catch {}
            posthog.capture('pro_session_restored', {
              email: me.email,
               pro_source: me.pro_source,
             });
           }
           safeNavigate(`/?restore=${proOk ? "ok" : "not_pro"}`);
           return;
         }

         if (tokenToUse) {
           const session = await supabase.auth.getSession();
          const userEmail = session.data.session?.user?.email;
          if (userEmail) {
            posthog.identify(userEmail, { email: userEmail });
          }
           posthog.capture('user_signed_in');
           await getSessionMe({ sessionId, accessToken: tokenToUse });
         }

         safeNavigate("/");
       } catch {
         // best effort
         safeNavigate("/");
       }
     })();
  }, [accessToken, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 text-center space-y-2">
        <p className="font-semibold">Signing you in…</p>
        <p className="text-sm text-muted-foreground">You can close this tab if nothing happens.</p>
      </div>
    </div>
  );
}
