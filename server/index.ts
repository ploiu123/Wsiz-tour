// Serwer gry WSiZ Tour: pokoje online przez WebSocket (Socket.IO) i, opcjonalnie, pliki gry z dist/.
// Uruchomienie: npm run server  (port z PORT, domyślnie 3000). Ustawienia w pliku .env (zob. .env.example).
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { buildBank, type RawBank } from '../src/core/questions.ts';
import { Room, newCode, type LobbyState } from './room.ts';
import { serveStatic } from './static.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Baza pytań z pytania/baza-pytan.js (plik z Excela). Na serwerze, więc gracze online nie widzą odpowiedzi.
export function loadBank(): RawBank | undefined {
  const file = `${ROOT}pytania/baza-pytan.js`;
  if (!existsSync(file)) return undefined;
  const text = readFileSync(file, 'utf-8');
  const start = text.indexOf('{');
  try { return JSON.parse(text.slice(start, text.lastIndexOf('}') + 1)) as RawBank; } catch { return undefined; }
}

const nameOk = (v: unknown): string | null => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s.length >= 2 ? s : null;
};

export function createGameServer({ staticDir = process.env.STATIC_DIR ?? `${ROOT}dist`, corsOrigin = process.env.CORS_ORIGIN, pace = Number(process.env.GAME_PACE) || 1 } = {}) {
  const http = createServer(serveStatic(staticDir));
  const io = new Server(http, { cors: corsOrigin ? { origin: corsOrigin.split(',') } : undefined, maxHttpBufferSize: 64 * 1024 });
  const rooms = new Map<string, Room>();
  const raw = loadBank();
  const send = (sid: string, type: string, payload: unknown) => io.to(sid).emit(type, payload);
  const roomOf = (code: unknown) => { const r = rooms.get(String(code ?? '').toUpperCase()); return r && !r.closed ? r : undefined; };
  type Ack = (reply: unknown) => void;
  const safe = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});

  // Pokój bez graczy znika po 10 minutach
  setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.closed) { rooms.delete(code); continue; }
      if (!room.empty) { room.idleSince = 0; continue; }
      room.idleSince ||= Date.now();
      if (room.idleSince < Date.now() - 600_000) { room.close(); rooms.delete(code); }
    }
  }, 60_000).unref();

  io.on('connection', (socket: Socket) => {
    let room: Room | null = null, token = '';

    socket.on('create', (msg: { name?: unknown; config?: unknown }, ack) => {
      const reply = safe(ack);
      const name = nameOk(msg?.name), config = Room.validate(msg?.config);
      if (!name || !config) return reply({ error: 'Złe ustawienia gry albo nick (2–20 znaków).' });
      let code = newCode();
      while (rooms.has(code)) code = newCode();
      room = new Room(code, config, send, pace);
      rooms.set(code, room);
      const seat = room.claim('host', name, socket.id)!;
      token = seat.token;
      reply({ code, token, seat: seat.seat, lobby: room.lobby() });
      room.broadcastLobby();
    });

    socket.on('join', (msg: { code?: unknown; name?: unknown; pawnIdx?: unknown }, ack) => {
      const reply = safe(ack);
      const r = roomOf(msg?.code), name = nameOk(msg?.name);
      if (!r) return reply({ error: 'Nie ma party z takim kodem.' });
      if (!name) return reply({ error: 'Nick musi mieć od 2 do 20 znaków.' });
      const seat = r.claim('online', name, socket.id, Number(msg?.pawnIdx));
      if (!seat) return reply({ error: r.engine ? 'Ta gra już trwa.' : 'Wszystkie miejsca są zajęte.' });
      room = r;
      token = seat.token;
      reply({ code: r.code, token, seat: seat.seat, lobby: r.lobby() });
      r.broadcastLobby();
    });

    // Powrót po rozłączeniu (np. odświeżenie strony): ten sam token, to samo miejsce
    socket.on('resume', (msg: { code?: unknown; token?: unknown }, ack) => {
      const reply = safe(ack);
      const r = roomOf(msg?.code);
      const seat = r ? r.connect(String(msg?.token ?? ''), socket.id) : -1;
      if (!r || seat < 0) return reply({ error: 'Nie da się wrócić do tej gry.' });
      room = r;
      token = String(msg?.token);
      reply({ code: r.code, token, seat, lobby: r.lobby(), game: r.engine ? r.startMsg(seat) : null });
      if (!r.engine) r.broadcastLobby();
    });

    socket.on('start', (_msg, ack) => {
      const reply = safe(ack);
      if (!room || room.seats[room.seatOf(token)]?.kind !== 'host') return reply({ error: 'Grę zaczyna gospodarz.' });
      if (!room.start(buildBank(raw, room.config.semester))) return reply({ error: 'Nie wszyscy gracze dołączyli.' });
      reply({ ok: true });
    });

    socket.on('ready', (id: unknown) => { if (room && Number.isInteger(id)) room.ready(token, id as number); });
    socket.on('submit', (msg: { id?: unknown; value?: unknown }, ack) => {
      const ok = !!room && Number.isInteger(msg?.id) && room.submit(token, msg.id as number, msg.value ?? null);
      safe(ack)({ ok });
    });
    socket.on('end', (_msg, ack) => safe(ack)({ ok: !!room && room.endNow(token) }));
    socket.on('leave', () => { room?.leave(socket.id); room = null; token = ''; });
    socket.on('disconnect', () => { room?.disconnect(socket.id); });
  });

  return { http, io, rooms, lobby: (code: string): LobbyState | undefined => rooms.get(code)?.lobby() };
}

// Uruchomienie z wiersza poleceń
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  const { http } = createGameServer();
  http.listen(port, () => console.log(`Serwer WSiZ Tour: http://localhost:${port}`));
}
