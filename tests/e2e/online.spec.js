// Gra online: dwie przeglądarki (gospodarz i gość) i serwer gry. Party z kodem, gra, powrót po odświeżeniu, koniec.
import { test, expect } from '@playwright/test';

const GAME = 'http://localhost:4174/';
const SLOTS = [{ kind: 'me', pawn: 0, color: 0 }, { kind: 'online', pawn: 1, color: 1 }, { kind: 'bot', level: 'łatwy', pawn: 2, color: 2 }, { kind: 'bot', level: 'trudny', pawn: 3, color: 3 }];

async function player(browser, nick, online) {
  const context = await browser.newContext({ viewport: { width: 900, height: 640 } });   // mniejsze okna: dwie gry 3D naraz bez karty graficznej
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([nick, online, slots]) => {
    localStorage.setItem('wsiz-tour-profil', JSON.stringify({ nick, guest: true, pawn: nick === 'Ola' ? 3 : 0, color: 0 }));
    if (!localStorage.getItem('wsiz-tour-nowa-gra-2')) {
      localStorage.setItem('wsiz-tour-nowa-gra-2', JSON.stringify({ mode: 'online', online, joinCode: '', teams: false, semester: 8, timer: 0, slots }));
    }
  }, [nick, online, SLOTS]);
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
