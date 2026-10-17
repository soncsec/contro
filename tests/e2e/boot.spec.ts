import { expect, test } from '@playwright/test';
import { sceneKey, watchPage } from './watch';

test('boots with no console errors and no third-party requests', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Boot');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('canvas is scaled by a whole number', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Boot');
  const box = await page.locator('#game canvas').boundingBox();
  expect(box).not.toBeNull();
  // 320x176 at zoom 4 (1366 / 320 = 4.27, 768 / 176 = 4.36)
  expect(box?.width).toBe(1280);
  expect(box?.height).toBe(704);
});
