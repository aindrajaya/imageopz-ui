import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getSessionMe, restoreProSession, ImageOpzApiError } from "@/lib/imageopzApi";
import { supabase } from "@/lib/supabaseClient";

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
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

        const tokenToUse = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? null;
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
            navigate("/?restore=not_pro", { replace: true });
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
              navigate("/?restore=not_pro", { replace: true });
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
            navigate("/?restore=not_pro", { replace: true });
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
          }
          navigate(`/?restore=${proOk ? "ok" : "not_pro"}`, { replace: true });
          return;
        }

        if (tokenToUse) await getSessionMe({ sessionId, accessToken: tokenToUse });
      } catch {
        // best effort
      } finally {
        navigate("/", { replace: true });
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
