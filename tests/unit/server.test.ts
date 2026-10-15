import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createGameServer } from '../../server/index.ts';
import type { GameEvent } from '../../src/core/types.ts';

let server: ReturnType<typeof createGameServer>;
let url = '';
beforeAll(async () => {
  server = createGameServer({ staticDir: '/nie-ma-takiego-folderu', pace: 0.05 });
  await new Promise<void>(r => server.http.listen(0, r));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});
afterAll(async () => {
  for (const room of server.rooms.values()) room.close();
  await new Promise<void>(r => { server.io.close(); r(); });
});

const client = () => connect(url, { transports: ['websocket'], forceNew: true });
const call = <T>(s: Socket, type: string, msg?: unknown) => new Promise<T>(r => s.emit(type, msg, r));
const seats = [
  { kind: 'host', pawnIdx: 0, colorIdx: 0 }, { kind: 'online', pawnIdx: 1, colorIdx: 1 },
  { kind: 'bot', level: 'trudny', pawnIdx: 2, colorIdx: 2 }, { kind: 'bot', level: 'łatwy', pawnIdx: 3, colorIdx: 3 },
];

describe('serwer gry online', () => {
  it('odrzuca złe ustawienia i zły kod', async () => {
    const s = client();
    expect(await call<{ error?: string }>(s, 'create', { name: 'A', config: { seats } })).toHaveProperty('error');   // nick za krótki
    expect(await call<{ error?: string }>(s, 'create', { name: 'Ania', config: { seats: [seats[0]], teams: false, semester: 8, timer: 0 } })).toHaveProperty('error');
    expect(await call<{ error?: string }>(s, 'join', { code: 'ZZZZZZ', name: 'Ola' })).toHaveProperty('error');
    s.close();
  });

  it('gospodarz i gość grają z botami; decyzje tylko własne, karty innych ukryte, koniec przez gospodarza', async () => {
    const host = client(), guest = client();
    const created = await call<{ code: string; token: string; lobby: { canStart: boolean } }>(host, 'create', { name: 'Patryk', config: { seats, teams: false, semester: 8, timer: 0 } });
    expect(created.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.lobby.canStart).toBe(false);   // czeka na gracza online
    const joined = await call<{ seat: number; lobby: { canStart: boolean } }>(guest, 'join', { code: created.code.toLowerCase(), name: 'Ola', pawnIdx: 2 });
    expect(joined.seat).toBe(1);
    expect(joined.lobby.canStart).toBe(true);
    expect(await call<{ error?: string }>(guest, 'start')).toHaveProperty('error');   // gość nie zaczyna gry

    const events: Record<string, GameEvent[]> = { host: [], guest: [] };
    let stolen = 0, hostMoves = 0, guestMoves = 0;
    const play = (s: Socket, who: 'host' | 'guest', seat: number) => {
      s.on('event', async (ev: GameEvent) => {
        events[who].push(ev);
        if (ev.type !== 'decision') return;
        s.emit('ready', ev.decision.id);
        const d = ev.decision;
        if (d.player !== seat) {
          // próba decyzji za innego gracza musi się nie udać
          if (d.kind === 'roll' && who === 'guest' && (await call<{ ok: boolean }>(s, 'submit', { id: d.id, value: null })).ok) stolen++;
          return;
        }
        const value = d.kind === 'answer' ? d.gone.length ? [0, 1, 2, 3].find(k => !d.gone.includes(k)) : 0
          : d.kind === 'choose' ? d.options.find(o => !o.disabled)!.value : null;
        const r = await call<{ ok: boolean }>(s, 'submit', { id: d.id, value });
        if (r.ok) { if (who === 'host') hostMoves++; else guestMoves++; }
      });
    };
    play(host, 'host', 0);
    play(guest, 'guest', 1);
    const started = new Promise(r => guest.once('start', r));
    expect(await call<{ ok?: boolean }>(host, 'start')).toEqual({ ok: true });
    const start = await started as { you: number; snap: { players: { name: string }[] } };
    expect(start.you).toBe(1);
    expect(start.snap.players.map(p => p.name)).toEqual(['Patryk', 'Ola', 'Bot 3', 'Bot 4']);

    // gramy, aż obaj ludzie wykonają po kilka ruchów
    for (let k = 0; k < 400 && (hostMoves < 6 || guestMoves < 6); k++) await new Promise(r => setTimeout(r, 50));
    expect(hostMoves).toBeGreaterThanOrEqual(6);
    expect(guestMoves).toBeGreaterThanOrEqual(6);
    expect(stolen).toBe(0);

    // karty innych graczy są ukryte; dobre odpowiedzi nigdy nie przychodzą do przeglądarki
    for (const ev of events.guest) {
      for (const p of ev.snap.players) if (p.idx !== 1) expect(p.cards.every(c => c.icon === 'hidden')).toBe(true);
      if (ev.type === 'decision' && ev.decision.kind === 'answer') expect(ev.decision.question).not.toHaveProperty('ok');
    }

    const overGuest = new Promise<GameEvent>(r => guest.on('event', (ev: GameEvent) => { if (ev.type === 'over') r(ev); }));
    expect(await call<{ ok: boolean }>(guest, 'end')).toEqual({ ok: false });   // kończy tylko gospodarz
    expect(await call<{ ok: boolean }>(host, 'end')).toEqual({ ok: true });
    const over = await overGuest;
    expect(over.type === 'over' && over.result.reason).toBe('manual');
    host.close(); guest.close();
  }, 120_000);

  it('gospodarz decyduje też za gracza przy swoim komputerze', async () => {
    const host = client();
    const { lobby } = await call<{ lobby: { canStart: boolean; seats: { name: string }[] } }>(host, 'create', {
      name: 'Patryk', config: { seats: [seats[0], { kind: 'local', pawnIdx: 1, colorIdx: 1 }], teams: false, semester: 8, timer: 0 },
    });
    expect(lobby.canStart).toBe(true);
    expect(lobby.seats[1].name).toBe('Gracz 2');
    const moves = [0, 0];
    host.on('event', async (ev: GameEvent) => {
      if (ev.type !== 'decision') return;
      host.emit('ready', ev.decision.id);
      const d = ev.decision;
      const value = d.kind === 'answer' ? 0 : d.kind === 'choose' ? d.options.find(o => !o.disabled)!.value : null;
      if ((await call<{ ok: boolean }>(host, 'submit', { id: d.id, value })).ok) moves[d.player]++;
    });
    const started = new Promise<{ mine: number[] }>(r => host.once('start', r));
    expect(await call<{ ok?: boolean }>(host, 'start')).toEqual({ ok: true });
    expect((await started).mine).toEqual([0, 1]);
    for (let k = 0; k < 400 && (moves[0] < 4 || moves[1] < 4); k++) await new Promise(r => setTimeout(r, 50));
    expect(moves[1]).toBeGreaterThanOrEqual(4);
    host.close();
  }, 60_000);

  it('gracz wraca po rozłączeniu na swoje miejsce', async () => {
    const host = client(), guest = client();
    const { code } = await call<{ code: string }>(host, 'create', { name: 'Gospodarz', config: { seats: [seats[0], seats[1]], teams: false, semester: 8, timer: 0 } });
    const { token } = await call<{ token: string }>(guest, 'join', { code, name: 'Gość' });
    guest.close();
    await new Promise(r => setTimeout(r, 100));
    expect(server.lobby(code)!.seats[1].connected).toBe(false);
    const again = client();
    const back = await call<{ seat: number }>(again, 'resume', { code, token });
    expect(back.seat).toBe(1);
    expect(server.lobby(code)!.seats[1].connected).toBe(true);
    expect(await call<{ error?: string }>(again, 'resume', { code, token: 'zly-token' })).toHaveProperty('error');
    host.close(); again.close();
  });

  it('widz: ogląda grę z kodem, dostaje zdarzenia bez kart graczy, nie decyduje i nie wysyła emotek', async () => {
    const host = client(), watcher = client();
    const { code } = await call<{ code: string }>(host, 'create', { name: 'Gospodarz', config: { seats: [seats[0], seats[2]], teams: false, semester: 8, timer: 0 } });
    expect(await call<{ error?: string }>(watcher, 'watch', { code: 'ZZZZZZ', name: 'Widz' })).toHaveProperty('error');
    const w = await call<{ seat: number; token: string; game: unknown; lobby: { watchers: number } }>(watcher, 'watch', { code, name: 'Widz' });
    expect(w.seat).toBe(-1);
    expect(w.token).toBe('');
    expect(w.game).toBeNull();   // gra jeszcze się nie zaczęła
    expect(server.lobby(code)!.watchers).toBe(1);
    const evs: GameEvent[] = [];
    const emotes: unknown[] = [];
    let started = false, stolen = 0;
    watcher.on('start', () => { started = true; });
    watcher.on('emote', m => emotes.push(m));
    watcher.on('event', async (ev: GameEvent) => {
      evs.push(ev);
      if (ev.type === 'decision' && (await call<{ ok: boolean }>(watcher, 'submit', { id: ev.decision.id, value: null })).ok) stolen++;
    });
    host.on('event', (ev: GameEvent) => { if (ev.type === 'decision' && ev.decision.player === 0) host.emit('submit', { id: ev.decision.id, value: ev.decision.kind === 'choose' ? ev.decision.options.find(o => !o.disabled)!.value : ev.decision.kind === 'answer' ? 0 : null }, () => {}); });
    expect((await call<{ ok?: boolean }>(host, 'start')).ok).toBe(true);
    await new Promise(r => setTimeout(r, 1500));
    expect(started).toBe(true);
    expect(evs.length).toBeGreaterThan(3);
    expect(stolen).toBe(0);
    for (const ev of evs) for (const p of ev.snap.players) for (const c of p.cards) expect(c.icon).toBe('hidden');
    watcher.emit('emote', 1);
    host.emit('emote', 2);
    await new Promise(r => setTimeout(r, 200));
    expect(emotes).toEqual([{ player: 0, k: 2 }]);   // widz widzi emotki graczy, ale sam nie wysyła
    // dołączenie w trakcie gry: od razu stan gry; wyjście widza zmniejsza licznik
    const late = client();
    const l = await call<{ game: { you: number; mine: number[] } | null }>(late, 'watch', { code, name: 'Spóźniony' });
    expect(l.game?.you).toBe(-1);
    expect(l.game?.mine).toEqual([]);
    expect(server.lobby(code)!.watchers).toBe(2);
    late.close();
    await new Promise(r => setTimeout(r, 150));
    expect(server.lobby(code)!.watchers).toBe(1);
    host.close(); watcher.close();
  });

  it('emotki: trafiają do wszystkich w pokoju, najwyżej jedna na 1,5 s, tylko z listy', async () => {
    const host = client(), guest = client();
    const { code } = await call<{ code: string }>(host, 'create', { name: 'Gospodarz', config: { seats: [seats[0], seats[1]], teams: false, semester: 8, timer: 0 } });
    await call(guest, 'join', { code, name: 'Gość' });
    const got: { player: number; k: number }[] = [];
    guest.on('emote', (m: { player: number; k: number }) => got.push(m));
    host.emit('emote', 1);   // przed startem gry: ignorowana
    expect((await call<{ ok?: boolean }>(host, 'start')).ok).toBe(true);
    host.emit('emote', 2);
    host.emit('emote', 3);    // za szybko po poprzedniej
    host.emit('emote', 99);   // spoza listy
    guest.emit('emote', 'x'); // nie liczba
    await new Promise(r => setTimeout(r, 200));
    expect(got).toEqual([{ player: 0, k: 2 }]);
    host.close(); guest.close();
  });
});

