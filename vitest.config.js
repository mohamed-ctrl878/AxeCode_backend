import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./tests/setup/global-setup.js'],
    setupFiles: [],
    fileParallelism: false,
    deps: {
      interopDefault: true,
      optimizer: {
        web: {
          include: ['@strapi/strapi']
        }
      }
    }
  },
});
