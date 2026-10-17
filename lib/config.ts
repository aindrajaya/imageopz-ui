// Every VITE_ variable is read here and nowhere else. All of them ship to the browser: public values only.
// Direct `import.meta.env.VITE_*` property access keeps Vite's build-time replacement working.

export interface AppConfig {
  apiBaseUrl: string;
  useViteProxy: boolean;
  sendCookies: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseRedirectUrl: string;
  posthogToken: string;
  posthogHost: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readConfig(): AppConfig {
  return {
    apiBaseUrl: text(import.meta.env.VITE_IMAGEOPZ_API_BASE_URL).replace(/\/+$/, ""),
    useViteProxy: text(import.meta.env.VITE_IMAGEOPZ_USE_VITE_PROXY) === "true",
    // Header-only sessions (X-Session-Id) when "false"; anything else sends the session cookie.
    sendCookies: text(import.meta.env.VITE_IMAGEOPZ_SEND_COOKIES) !== "false",
    supabaseUrl: text(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: text(import.meta.env.VITE_SUPABASE_ANON_KEY),
    supabaseRedirectUrl: text(import.meta.env.VITE_SUPABASE_REDIRECT_URL),
    posthogToken: text(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN),
    posthogHost: text(import.meta.env.VITE_PUBLIC_POSTHOG_HOST),
  };
}

// A message for the config error screen, or null. Production has no dev proxy and the Vercel SPA rewrite answers
// same-origin /api calls with index.html, so a production build without an API base URL cannot work.
export function getConfigError(config: AppConfig = readConfig()): string | null {
  if (import.meta.env.PROD && !config.apiBaseUrl) {
    return "VITE_IMAGEOPZ_API_BASE_URL is not set for this deployment.";
  }
  return null;
}
