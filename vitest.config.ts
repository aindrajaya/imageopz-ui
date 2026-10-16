import path from 'path';
import {defineConfig} from 'vitest/config';

// Separate from vite.config.ts so tests never load .env values or the dev proxy; tests set env with vi.stubEnv.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
