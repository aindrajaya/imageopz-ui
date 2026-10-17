import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfigError, readConfig } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readConfig", () => {
  it("reads every VITE_ variable in one place", () => {
    vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", "https://api.test///");
    vi.stubEnv("VITE_IMAGEOPZ_USE_VITE_PROXY", "true");
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("VITE_SUPABASE_REDIRECT_URL", "https://ui.test/auth/callback");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_x");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");

    expect(readConfig()).toMatchObject({
      apiBaseUrl: "https://api.test",
      useViteProxy: true,
      sendCookies: false,
      supabaseUrl: "https://x.supabase.co",
      supabaseAnonKey: "anon",
      supabaseRedirectUrl: "https://ui.test/auth/callback",
      posthogToken: "phc_x",
      posthogHost: "https://eu.i.posthog.com",
    });
  });

  it("sends cookies unless the flag is exactly \"false\"", () => {
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "");
    expect(readConfig().sendCookies).toBe(true);
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", "true");
    expect(readConfig().sendCookies).toBe(true);
    vi.stubEnv("VITE_IMAGEOPZ_SEND_COOKIES", " false ");
    expect(readConfig().sendCookies).toBe(false);
  });

  it("treats blank values as unset", () => {
    vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", "  ");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    const config = readConfig();
    expect(config.apiBaseUrl).toBe("");
    expect(config.posthogToken).toBe("");
  });
});

describe("getConfigError", () => {
  it("reports a missing API base URL in production builds", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", "");
    expect(getConfigError()).toMatch(/VITE_IMAGEOPZ_API_BASE_URL/);
  });

  it("accepts production with an API base URL and Supabase settings", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", "https://api.test");
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    expect(getConfigError()).toBeNull();
  });

  it("reports missing Supabase settings in production builds", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", "https://api.test");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    expect(getConfigError()).toMatch(/VITE_SUPABASE_URL/);
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", " ");
    expect(getConfigError()).toMatch(/VITE_SUPABASE_ANON_KEY/);
  });

  it("allows a missing API base URL outside production (dev proxy or same origin)", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_IMAGEOPZ_API_BASE_URL", "");
    expect(getConfigError()).toBeNull();
  });
});
