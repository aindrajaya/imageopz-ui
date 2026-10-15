import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Always resolve env relative to this config file to avoid issues when `vite`
  // is launched from a different working directory.
  const env = loadEnv(mode, __dirname, '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Ensure this value is available even if `.env` loading is flaky in some environments.
      'import.meta.env.VITE_IMAGEOPZ_API_BASE_URL': JSON.stringify(env.VITE_IMAGEOPZ_API_BASE_URL ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // Avoid CORS during local dev: frontend calls `/api/...`, Vite proxies to backend.
        '/api': {
          target: env.VITE_IMAGEOPZ_API_BASE_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
