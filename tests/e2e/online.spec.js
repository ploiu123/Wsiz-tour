// Gra online: dwie przeglądarki (gospodarz i gość) i serwer gry. Party z kodem, gra, powrót po odświeżeniu, koniec.
import { test, expect } from '@playwright/test';

const GAME = 'http://localhost:4174/';
const SLOTS = [{ kind: 'me', pawn: 0, color: 0 }, { kind: 'online', pawn: 1, color: 1 }, { kind: 'bot', level: 'łatwy', pawn: 2, color: 2 }, { kind: 'bot', level: 'trudny', pawn: 3, color: 3 }];

async function player(browser, nick, online, slots = SLOTS) {
  // mniejsze okna i krótkie animacje (ograniczony ruch): dwie gry 3D naraz bez karty graficznej odtwarzają zdarzenia
  // z animacjami klatka po klatce, a ten test sprawdza grę przez sieć, nie animacje
  const context = await browser.newContext({ viewport: { width: 900, height: 640 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([nick, online, slots]) => {
    localStorage.setItem('wsiz-tour-profil', JSON.stringify({ nick, guest: true, pawn: nick === 'Ola' ? 3 : 0, color: 0 }));
    if (!localStorage.getItem('wsiz-tour-nowa-gra-2')) {
      localStorage.setItem('wsiz-tour-nowa-gra-2', JSON.stringify({ mode: 'online', online, joinCode: '', teams: false, semester: 8, timer: 0, slots }));
    }
  }, [nick, online, slots]);
  await page.goto(GAME);
  return { page, errors, context };
}

// okna znikają same, więc klik ma krótki limit i może się nie udać
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  if (!(await el.isVisible().catch(() => false))) return false;
  return el.click({ force: true, timeout: 2000 }).then(() => true, () => false);
};
const act = async page => await tap(page, '#gRoll') || await tap(page, '.g-ans button:not(:disabled)') || await tap(page, '.g-modal [data-ok]') || await tap(page, '.g-modal [data-k]:not(:disabled)');

test('online: party z kodem, gospodarz i gość grają, powrót po odświeżeniu, koniec gry', async ({ browser }) => {
  test.setTimeout(720_000);
  const host = await player(browser, 'Patryk', 'create');
  const guest = await player(browser, 'Ola', 'join');

  // gospodarz tworzy party i dostaje kod
  await host.page.locator('[data-go="play"]').click();
  await expect(host.page.locator('#btnStart')).toHaveText('Stwórz party');
  await host.page.locator('#btnStart').click();
  await expect(host.page.locator('#pgLobby')).toBeVisible();
  const code = (await host.page.locator('#lobbyCode').textContent()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(host.page.locator('#btnLobbyStart')).toBeDisabled();   // czeka na gracza online

  // gość dołącza kodem
  await guest.page.locator('[data-go="play"]').click();
  await expect(guest.page.locator('#btnStart')).toBeDisabled();
  await guest.page.locator('#joinCode').fill(code.toLowerCase());
  await guest.page.locator('#btnStart').click();
  await expect(guest.page.locator('#pgLobby')).toBeVisible();
  await expect(guest.page.locator('#lobbySeats')).toContainText('Ola (Ty)');
  await expect(guest.page.locator('#btnLobbyStart')).toBeHidden();   // grę zaczyna gospodarz
  await expect(host.page.locator('#lobbySeats')).toContainText('Ola');

  await host.page.locator('#btnLobbyStart').click();
  for (const { page } of [host, guest]) {
    await expect(page.locator('.g-player')).toHaveCount(4);
    await expect(page.locator('#gPlayers')).toContainText('Patryk');
    await expect(page.locator('#gPlayers')).toContainText('Ola');
  }

  // obaj gracze grają swoje ruchy
  let hostActs = 0, guestActs = 0;
  for (let k = 0; k < 200 && (hostActs < 2 || guestActs < 2); k++) {
    if (await act(host.page)) hostActs++;
    if (await act(guest.page)) guestActs++;
    await host.page.waitForTimeout(500);
  }
  expect(hostActs).toBeGreaterThanOrEqual(2);
  expect(guestActs).toBeGreaterThanOrEqual(2);

  // gość odświeża stronę i wraca na swoje miejsce w tej samej grze
  // (w teście bez karty graficznej wczytanie strony obok drugiej gry 3D trwa nawet kilka minut)
  await guest.page.reload({ waitUntil: 'commit' });
  await expect(guest.page.locator('.g-player')).toHaveCount(4, { timeout: 300_000 });
  await expect(guest.page.locator('#menu')).toBeHidden();

  // gospodarz kończy grę dla wszystkich
  await host.page.locator('#gMenuBtn').click();
  await host.page.locator('[data-p="end"]').click();
  // (bez karty graficznej strona gościa po odświeżeniu jest wolna: dwie gry 3D w jednym procesorze)
  for (const { page } of [host, guest]) await expect(page.locator('table.g-end')).toBeVisible({ timeout: 180_000 });

  expect(host.errors).toEqual([]);
  expect(guest.errors).toEqual([]);
  await host.context.close();
  await guest.context.close();
});

test('online: widz ogląda grę z kodem, bez kart i bez decyzji', async ({ browser }) => {
  test.setTimeout(360_000);
  const BOTS = [{ kind: 'me', pawn: 0, color: 0 }, ...[1, 2, 3].map(k => ({ kind: 'bot', level: 'łatwy', pawn: k, color: k }))];
  const host = await player(browser, 'Patryk', 'create', BOTS);
  const fan = await player(browser, 'Kibic', 'watch');
  await host.page.locator('[data-go="play"]').click();
  await host.page.locator('#btnStart').click();
  await expect(host.page.locator('#pgLobby')).toBeVisible();
  const code = (await host.page.locator('#lobbyCode').textContent()).trim();

  await fan.page.locator('[data-go="play"]').click();
  await expect(fan.page.locator('#btnStart')).toContainText('Oglądaj grę');
  await fan.page.locator('#joinCode').fill(code);
  await fan.page.locator('#btnStart').click();
  await expect(fan.page.locator('#lobbyHint')).toContainText('jako widz');
  await expect(host.page.locator('#lobbyInfo')).toContainText('widzowie: 1');

  await host.page.locator('#btnLobbyStart').click();
  await expect(fan.page.locator('.g-player')).toHaveCount(4);
  await expect(fan.page.locator('#gWatch')).toContainText('Oglądasz');
  await expect(fan.page.locator('#gHand')).toBeHidden();
  await expect(fan.page.locator('#gEmotes')).toBeHidden();
  await expect(host.page.locator('#gWatch')).toContainText('Widzowie');
  // widz widzi rzut gospodarza, ale sam nie dostaje przycisku rzutu
  await expect(host.page.locator('#gRoll')).toBeVisible({ timeout: 120_000 });
  await host.page.locator('#gRoll').click({ force: true });
  await expect(fan.page.locator('#gStatus')).toHaveText(/\d \+ \d = \d+/, { timeout: 90_000 });
  expect(await fan.page.locator('#gRoll').isVisible()).toBe(false);
  // zerwane połączenie u gospodarza: nakładka „Połączenie zerwane”, a po powrocie gra toczy się dalej
  await host.page.evaluate(() => {
    const el = document.getElementById('gLost');
    new MutationObserver(() => { if (!el.hidden) window.lostSeen = true; }).observe(el, { attributes: true });
    window.__t.dropNet();
  });
  await expect(host.page.locator('#toast')).toContainText('Połączenie wróciło', { timeout: 60_000 });
  expect(await host.page.evaluate(() => window.lostSeen)).toBe(true);
  await expect(host.page.locator('#gLost')).toBeHidden();
  await expect(host.page.locator('.g-player')).toHaveCount(4);
  // widz wychodzi z menu: gospodarz widzi, że już nikt nie ogląda
  await fan.page.keyboard.press('Escape');
  await fan.page.locator('[data-p="quit"]').click();
  await expect(host.page.locator('#gWatch')).toBeHidden({ timeout: 30_000 });
  expect(host.errors).toEqual([]);
  expect(fan.errors).toEqual([]);
  await host.context.close();
  await fan.context.close();
});
