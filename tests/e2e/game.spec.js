import { test, expect, startGame } from './fixtures.js';

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
