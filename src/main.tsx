import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from "@/context/AuthContext";
import { getConfigError, readConfig } from "@/lib/config";
import posthog from 'posthog-js';
import { PostHogProvider, PostHogErrorBoundary } from '@posthog/react';

const config = readConfig();
const configError = getConfigError(config);

// No token (e.g. staging with analytics off) means no PostHog at all.
if (config.posthogToken && !configError) {
  posthog.init(config.posthogToken, {
    api_host: config.posthogHost || undefined,
    defaults: '2026-01-30',
  });
}

// A misconfigured deployment shows what is wrong instead of a blank page.
function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-lg font-semibold">ImageOpz is not configured</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">Set the variable in the hosting environment and redeploy.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  configError ? (
    <ConfigErrorScreen message={configError} />
  ) : (
    <StrictMode>
      <PostHogProvider client={posthog}>
        <PostHogErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </PostHogErrorBoundary>
      </PostHogProvider>
    </StrictMode>
  ),
);
