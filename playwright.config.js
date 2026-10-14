// Testy w przeglądarce (npm run e2e). Budują paczkę testową i uruchamiają ją jak na serwerze.
// Pierwszy raz na komputerze: npx playwright install chromium
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 1440, height: 900 },
    // grafika 3D działa też bez karty graficznej (programowy WebGL)
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: [
    {
      command: 'npm run build:test && npx vite preview --outDir dist-test --port 4173 --strictPort',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      // serwer gry dla testu online: ta sama paczka testowa, boty grają szybciej
      command: 'node --experimental-strip-types --no-warnings server/index.ts',
      env: { PORT: '4174', STATIC_DIR: 'dist-test', GAME_PACE: '0.2' },
      url: 'http://localhost:4174/socket.io/?EIO=4&transport=polling',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
