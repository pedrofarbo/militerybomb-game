import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de browser rodam contra a BUILD DE PRODUÇÃO, não contra o dev server:
 * é a build que vai para o ar, e é nela que erros de caminho de asset e de
 * minificação aparecem.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    launchOptions: {
      // Alguns ambientes (containers de CI) trazem o Chromium num caminho fixo.
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ['--no-sandbox'],
    },
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile-landscape',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 915, height: 412 } },
    },
  ],

  webServer: {
    command: 'npm run build && npx vite preview --port ' + PORT,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
