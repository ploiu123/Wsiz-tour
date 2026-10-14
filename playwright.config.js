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
  webServer: {
    command: 'npm run build:test && npx vite preview --outDir dist-test --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
