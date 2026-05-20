import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'], // points to your Zone.js setup file
    include: ['src/**/*.spec.ts'],
    testTimeout: 10000,
  },
});
