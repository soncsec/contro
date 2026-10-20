import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, title, walkThroughExit, watchPage } from './watch';

/**
 * Level 3, the hive (M5.2). It starts in the alien base (owner chose "into the hive",
 * 2026-10-20). In the e2e build the training corridor is level 1, so the hive is level 4 here.
 */
test.describe.configure({ timeout: 120_000 });

async function openSection(page: Page, key: string): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate((k) => window.__contro?.startLevel(k), key);
  await expect.poll(async () => (await level(page)).level, { timeout: 15_000 }).toBe(key);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

test('4-1 the alien base loads in front of its back wall, with the marine on a bridge', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openSection(page, 'hive-1');
  const s = await level(page);
  expect(s.label).toBe('4-1');
  expect(s.scenery).toEqual(['alien-back', 'alien-structures']);
  expect(s.player.feetY).toBe(130); // the bridge's deck at 128, feet 2 px into it
  expect(s.widthPx).toBe(180 * 16);
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(1);
  // Spitting snakes (M5.1) on the raised bridges, above the floor.
  const snakes = s.enemies.filter((e) => e.type === 'spitting-snake');
  expect(snakes).toHaveLength(6);
  expect(snakes.every((e) => e.feetY < 130)).toBe(true);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('the last section so far ends the game with the ending card, then the end screen', async ({
  page,
}) => {
  await openSection(page, 'hive-1');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Dialogue');
  expect(await page.evaluate(() => window.__contro?.dialogue())).toMatchObject({
    card: 'level-3-end',
    more: [],
    nextLevel: null,
  });
  await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('End');
});
