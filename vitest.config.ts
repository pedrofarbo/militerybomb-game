import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tudo que é testável roda sem browser, por construção: `src/core` não
    // importa Phaser nem toca no DOM.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.data.ts'],
      reporter: ['text', 'html'],
    },
  },
});
