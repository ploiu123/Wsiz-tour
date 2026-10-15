import { test, expect, startGame, brightness } from './fixtures.js';

test('menu: logo, nazwa gry i przycisk Graj', async ({ page, errors }) => {
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('[data-go="play"]')).toBeVisible();
  await expect(page.locator('h1.m-title').filter({ visible: true })).toHaveText('WSiZ Tour');
  expect(errors).toEqual([]);
});

test('gra: 4 graczy po 2000 zł, rzut kostkami', async ({ page, errors }) => {
  await startGame(page);
  const players = page.locator('.g-player');
  await expect(players).toHaveCount(4);
  for (const p of await players.all()) await expect(p).toContainText('2000 zł');
  // plansza i makieta są widoczne (fragment między kartami graczy, z boku przycisku rzutu), a nie czarne
  expect(await brightness(page, { x: 340, y: 420, width: 260, height: 200 })).toBeGreaterThan(60);
  await page.locator('#gRoll').click({ force: true });   // przycisk pulsuje, więc klikamy bez czekania na „stabilny” element
  await expect(page.locator('#gStatus, .g-status').first()).toHaveText(/\d \+ \d = \d+/);
  expect(errors).toEqual([]);
});

test('prezentacja: link ?prezentacja i pierwsza scena', async ({ page, errors }) => {
  await page.goto('./?prezentacja');
  await page.locator('#prStartBtn').click();
  await expect(page.locator('#prStage .pr-scene').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__t.P.idx)).toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
});

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('gracze w jednym rzędzie, przycisk rzutu widoczny', async ({ page, errors }) => {
    await startGame(page);
    await expect(page.locator('.g-player')).toHaveCount(4);
    const boxes = await page.locator('.g-player').evaluateAll(els => els.map(e => e.getBoundingClientRect().top));
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(8);   // jeden rząd
    expect(errors).toEqual([]);
  });
});

test('rozgrywka: gracz rzuca, decyduje i odpowiada, boty grają, koniec gry z pauzy', async ({ page, errors }) => {
  test.setTimeout(420_000);
  await startGame(page);
  const turns = new Set();
  let actions = 0;
  // okna znikają same (np. po odpowiedzi bota), więc klik ma krótki limit i może się nie udać
  const tap = async sel => {
    const el = page.locator(sel).first();
    if (!(await el.isVisible().catch(() => false))) return false;
    return el.click({ force: true, timeout: 2000 }).then(() => true, () => false);
  };
  for (let k = 0; k < 160 && actions < 14; k++) {
    // gracz działa tylko wtedy, gdy gra na niego czeka; boty grają same
    if (await tap('#gRoll') || await tap('.g-ans button:not(:disabled)') || await tap('.g-modal [data-ok]') || await tap('.g-modal [data-k]:not(:disabled)')) actions++;
    turns.add(await page.evaluate(() => window.__t.G()?.turn));
    await page.waitForTimeout(1000);
  }
  expect(actions).toBeGreaterThan(3);
  expect(turns.size).toBeGreaterThan(1);   // tury przeszły też do botów
  await page.locator('#gMenuBtn').click();
  await page.locator('[data-p="end"]').click();
  await expect(page.locator('.g-end-head')).toBeVisible();
  await expect(page.locator('.g-end tbody tr')).toHaveCount(4);
  expect(errors).toEqual([]);
});
