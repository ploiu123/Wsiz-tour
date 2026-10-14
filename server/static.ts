// Pliki gry z folderu dist/ (paczka z npm run build), gdy serwer gry działa bez Nginxa.
// Wysyła gotowe wersje .br i .gz, a pliki z hashem w nazwie (app/) każe trzymać w cache na stałe.
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};

export function serveStatic(root: string) {
  const base = resolve(root);
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url || '/', 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (!path || path.endsWith('/')) path += 'index.html';
    const file = resolve(join(base, path));
    if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Nie ma takiego pliku');
      return;
    }
    const type = TYPES[extname(file)] || 'application/octet-stream';
    const accept = String(req.headers['accept-encoding'] || '');
    let send = file, encoding = '';
    if (/\bbr\b/.test(accept) && existsSync(`${file}.br`)) { send = `${file}.br`; encoding = 'br'; }
    else if (/\bgzip\b/.test(accept) && existsSync(`${file}.gz`)) { send = `${file}.gz`; encoding = 'gzip'; }
    const headers: Record<string, string> = {
      'content-type': type, vary: 'Accept-Encoding',
      'cache-control': path.startsWith('app/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    };
    if (encoding) headers['content-encoding'] = encoding;
    res.writeHead(200, headers);
    createReadStream(send).pipe(res);
  };
}
