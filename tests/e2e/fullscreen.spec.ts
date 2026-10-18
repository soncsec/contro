import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, watchPage } from './watch';

const fullscreenId = (page: Page) => page.evaluate(() => document.fullscreenElement?.id ?? null);
const canvasSize = (page: Page) =>
  page.locator('#game canvas').evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight }));

test('F toggles fullscreen, and the game keeps whole-number scaling', async ({ page }) => {
  const watched = watchPage(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  expect(await fullscreenId(page)).toBeNull();

  await page.keyboard.press('KeyF');
  await expect.poll(() => fullscreenId(page)).toBe('game');
  // Still a whole multiple of the 320×176 game screen.
  const size = await canvasSize(page);
  expect(size.w % 320).toBe(0);
  expect(size.h % 176).toBe(0);
  expect(size.w / 320).toBe(size.h / 176);

  await page.keyboard.press('KeyF');
  await expect.poll(() => fullscreenId(page)).toBeNull();
  // The game kept running throughout.
  expect((await level(page)).level).toBe('corridor-test');
  expect(watched.errors).toEqual([]);
});

test('F with a modifier key does nothing', async ({ page }) => {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await page.keyboard.press('Control+KeyF');
  await page.waitForTimeout(300);
  expect(await fullscreenId(page)).toBeNull();
});
