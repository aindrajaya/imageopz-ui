import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabase client", () => {
  it("loads without Supabase settings, so the app can show the config screen instead of a blank page", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const mod = await import("./supabaseClient");
    expect(mod.supabaseEnabled).toBe(false);
    expect(mod.supabase).toBeNull();
  });

  it("creates the client when both settings are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    const mod = await import("./supabaseClient");
    expect(mod.supabaseEnabled).toBe(true);
    expect(mod.supabase).not.toBeNull();
  });
});
