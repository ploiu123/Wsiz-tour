// Wspólne przygotowanie: zapisany profil gościa i ustawienia nowej gry (ja + 3 boty), lista błędów strony.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('wsiz-tour-profil', JSON.stringify({ nick: 'Patryk', guest: true, pawn: 0, color: 0 }));
      localStorage.setItem('wsiz-tour-nowa-gra-2', JSON.stringify({
        mode: 'solo', teams: false, online: 'create', code: '', joinCode: '', semester: 8, timer: 0,
        slots: [{ kind: 'me', pawn: 0, color: 0 }, ...[1, 2, 3].map(k => ({ kind: 'bot', level: 'trudny', pawn: k, color: k }))],
      }));
    });
    await use(errors);
  },
});
export { expect };

export async function startGame(page) {
  await page.goto('./');
  await page.locator('[data-go="play"]').click();
  await page.locator('#btnStart').click();
  await expect(page.locator('#gRoll')).toBeVisible();
}

// Średnia jasność (0–255) fragmentu ekranu: wykrywa czarny obraz 3D, którego inne testy nie widzą
export async function brightness(page, clip) {
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(async src => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let k = 0; k < d.length; k += 4) sum += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
    return sum / (d.length / 4);
  }, png);
}
