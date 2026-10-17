import { expect, test } from '@playwright/test';
import { sceneKey, watchPage } from './watch';

test('boots with no console errors and no third-party requests', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('canvas is scaled by a whole number', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  const box = await page.locator('#game canvas').boundingBox();
  expect(box).not.toBeNull();
  // 320x176 at zoom 4 (1366 / 320 = 4.27, 768 / 176 = 4.36)
  expect(box?.width).toBe(1280);
  expect(box?.height).toBe(704);
});

test('asset preview pages through every group with no console errors', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./?scene=preview');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('AssetPreview');
  const pageCount = await page.evaluate(() => window.__contro?.previewPageCount() ?? 0);
  const groups: (string | null)[] = [];
  for (let i = 0; i < pageCount; i++) {
    groups.push(await page.evaluate(() => window.__contro?.previewGroup() ?? null));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
  }
  // Every group appears, in manifest order (large groups may span several pages).
  expect([...new Set(groups)]).toEqual(['player', 'enemies', 'effects', 'levels']);
  // After the last page it wraps around to the first.
  expect(await page.evaluate(() => window.__contro?.previewGroup() ?? null)).toBe('player');
  expect(watched.errors).toEqual([]);
});
