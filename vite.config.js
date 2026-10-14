// Konfiguracja Vite: serwer do pracy (npm run dev) i paczka na serwer WWW (npm run build → dist/).
import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Pliki, które gra wczytuje po zwykłej ścieżce (nie przez import): logo, muzyka, pytania, wersja kart do druku,
// strona-wizytówka. Trafiają do paczki bez zmian.
const STATIC = ['assets', 'druk', 'pytania/baza-pytan.js', 'prezentacja-strona'];
const SKIP = /\.(md|py|xlsx)$|__pycache__|\.DS_Store$/;
// Utwory z Uppbeat mogą być tylko u autora (licencja), więc nie trafiają na serwer.
// Jeśli kiedyś będzie na to zgoda, wystarczy zbudować z WSIZ_LOCAL_MUSIC=1.
const LOCAL_ONLY = ['assets/muzyka/gra.mp3', 'assets/muzyka/gra-2.mp3'];

function copyStatic() {
  let outDir = 'dist';
  return {
    name: 'wsiz-copy-static',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      for (const path of STATIC) {
        if (existsSync(path)) cpSync(path, resolve(outDir, path), { recursive: true, filter: src => !SKIP.test(src) });
      }
      if (process.env.WSIZ_LOCAL_MUSIC !== '1') for (const f of LOCAL_ONLY) rmSync(resolve(outDir, f), { force: true });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',   // paczka działa w dowolnym folderze serwera (np. uczelnia.pl/gra/)
  define: { __TEST_HOOKS__: JSON.stringify(mode === 'test') },
  build: {
    target: 'es2022',   // gra czeka na czcionki i logo na najwyższym poziomie modułu (top-level await)
    outDir: mode === 'test' ? 'dist-test' : 'dist',
    assetsDir: 'app',   // pliki z Vite (z hashem w nazwie) osobno od naszego folderu assets/
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    copyStatic(),
    // gotowe pliki .br i .gz obok .js, .css i .html: serwer (Nginx, Apache) wysyła je bez kompresji w locie
    compression({ algorithms: ['gzip', 'brotliCompress'], include: /\.(js|css|html|svg|json)$/ }),
  ],
  test: { include: ['tests/unit/**/*.test.ts'] },   // Vitest: tylko nasze testy (bez testów skilli w .claude/)
  // npm run dev: gra online łączy się z serwerem gry (npm run server) przez ten sam adres
  server: { port: 5173, open: true, proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } } },
  preview: { port: 4173 },
}));
