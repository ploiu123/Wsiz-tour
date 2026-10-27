import fs from 'node:fs';
import { test, expect, startGame, brightness } from './fixtures.js';

test('menu: logo, nazwa gry i przycisk Graj', async ({ page, errors }) => {
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('[data-go="play"]')).toBeVisible();
  await expect(page.locator('h1.m-title').filter({ visible: true })).toHaveText('WSiZ Tour');
  expect(errors).toEqual([]);
});

test('nowa gra: karty graczy z pionkiem 3D, strzałki, puste miejsce i bot', async ({ page, errors }) => {
  await page.goto('./');
  await page.locator('[data-go="play"]').click();
  const seats = page.locator('#slots .m-seat');
  await expect(seats).toHaveCount(4);
  await expect(seats.first().locator('.m-seat-pawn b')).toHaveText('Sztandar');
  await seats.first().locator('.m-arrow.is-next').click();
  await expect(seats.first().locator('.m-seat-pawn b')).toHaveText('Drukarka 3D');
  // pionek w 3D: płótno w karcie ma obraz, a nie same przezroczyste piksele
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('#slots .m-stage-cv');
    if (!c || !c.width) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++;
    return n;
  }), { timeout: 60000 }).toBeGreaterThan(500);
  // miejsce 4: zwolnij, potem dodaj bota
  await seats.nth(3).locator('.m-seat-x').click();
  await expect(seats.nth(3)).toHaveClass(/is-empty/);
  await seats.nth(3).locator('.m-add[data-v="bot"]').click();
  await expect(seats.nth(3).locator('.chip[aria-pressed="true"]').first()).toHaveText('Bot');
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

test('samouczek i tryb zdjęć: podpowiedź przy rzucie, zdjęcie 4K, powrót do gry', async ({ page, errors }) => {
  test.setTimeout(240_000);
  await startGame(page);
  await expect(page.locator('#gTip')).toBeVisible();
  await expect(page.locator('#gTipTitle')).toHaveText('Rzut kostkami');
  await page.locator('#gTipOk').click();
  await expect(page.locator('#gTip')).toBeHidden();
  await page.locator('#gMenuBtn').click();
  await page.locator('[data-p="photo"]').click();
  await expect(page.locator('#photoBar')).toBeVisible();
  await expect(page.locator('#gHud')).toBeHidden();
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 150_000 }), page.locator('#photoShot').click()]);
  expect(file.suggestedFilename()).toMatch(/^wsiz-tour-.+\.png$/);
  const png = fs.readFileSync(await file.path());
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(3800);   // szerokość obrazu z nagłówka PNG
  await page.locator('#photoExit').click();
  await expect(page.locator('#photoBar')).toBeHidden();
  await expect(page.locator('#gRoll')).toBeVisible();   // gra stała w trybie zdjęć i dalej czeka na rzut
  expect(errors).toEqual([]);
});

test('menu w każdej chwili: Escape i przycisk Menu w oknie decyzji', async ({ page, errors }) => {
  test.setTimeout(300_000);
  await startGame(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.g-pause [data-p="back"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.g-pause')).toHaveCount(0);
  await page.locator('#gRoll').click({ force: true });
  // pierwsze okno w grze (decyzja gracza albo bota) ma własny przycisk Menu, bo zasłania ten w panelu
  await page.locator('.g-backdrop [data-menu]').first().click({ timeout: 200_000 });
  await page.locator('.g-pause [data-p="end"]').click();
  await expect(page.locator('.g-end-head')).toBeVisible();
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
  // gra mogła akurat czekać na decyzję gracza (okno zasłania menu): najpierw ją kończymy, potem pauza
  await expect(async () => {
    await tap('.g-ans button:not(:disabled)') || await tap('.g-modal [data-ok]') || await tap('.g-modal [data-k]:not(:disabled)');
    await page.locator('#gMenuBtn').click({ timeout: 1500 });
  }).toPass({ timeout: 120_000 });
  await page.locator('[data-p="end"]').click();
  await expect(page.locator('.g-end-head')).toBeVisible();
  await expect(page.locator('.g-end tbody tr')).toHaveCount(4);
  // najlepsze momenty (gdy w tej grze były): kamera przelatuje nad polami, Pomiń wraca do wyniku
  const moments = page.locator('[data-e="moments"]');
  if (await moments.isVisible()) {
    await moments.click();
    await expect(page.locator('.g-banner')).toBeVisible({ timeout: 30_000 });
    await page.locator('.g-replay-skip').click({ timeout: 3000 }).catch(() => {});   // powtórka mogła się już skończyć
    await expect(page.locator('.g-end-head')).toBeVisible({ timeout: 60_000 });
  }
  expect(errors).toEqual([]);
});
