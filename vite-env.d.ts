/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMAGEOPZ_API_BASE_URL?: string;
  readonly VITE_IMAGEOPZ_USE_VITE_PROXY?: string;
  readonly VITE_IMAGEOPZ_SEND_COOKIES?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_REDIRECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
