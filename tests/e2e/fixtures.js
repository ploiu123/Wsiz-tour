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
