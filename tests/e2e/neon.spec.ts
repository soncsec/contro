import { expect, test, type Page } from '@playwright/test';
import { level, title, walkThroughExit, watchPage } from './watch';

/**
 * Level 2, the Neon District (M4.3). In the e2e build the training corridor is level 1, so the
 * Neon District is level 3 here.
 */
test.describe.configure({ timeout: 120_000 });

async function openSection(page: Page, key: string): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate((k) => window.__contro?.startLevel(k), key);
  await expect.poll(async () => (await level(page)).level, { timeout: 15_000 }).toBe(key);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

test('3-1 the rooftops loads under the city skyline, with the marine on the roof', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openSection(page, 'neon-1');
  const s = await level(page);
  expect(s.label).toBe('3-1');
  expect(s.scenery).toEqual(['neon-sky', 'neon-buildings', 'neon-front']);
  expect(s.player.feetY).toBe(130); // the roof's top edge at 128, feet 2 px into it
  expect(s.widthPx).toBe(180 * 16);
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(1);
  // Level 2's own music (M4.5).
  await expect
    .poll(() => page.evaluate(() => window.__contro?.sound().music))
    .toBe('music-level-2');
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('3-1 leads straight into 3-2, with no card', async ({ page }) => {
  await openSection(page, 'neon-1');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('neon-2');
  expect((await level(page)).label).toBe('3-2');
});

test('3-2 the corridor loads with its props, catwalks and a bipedal walker', async ({ page }) => {
  const watched = watchPage(page);
  await openSection(page, 'neon-2');
  const s = await level(page);
  expect(s.label).toBe('3-2');
  expect(s.scenery).toEqual([]); // indoors: the corridor's own wall
  expect(s.player.feetY).toBe(160);
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(1);
  expect(watched.errors).toEqual([]);
});

test('3-2 leads straight into 3-3, with no card', async ({ page }) => {
  await openSection(page, 'neon-2');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('neon-3');
  const s = await level(page);
  expect(s.label).toBe('3-3');
  expect(s.scenery).toEqual(['neon-sky', 'neon-buildings', 'neon-front']);
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(2);
});

test('3-3 leads straight into 3-4, the lab, indoors', async ({ page }) => {
  await openSection(page, 'neon-3');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('neon-4');
  const s = await level(page);
  expect(s.label).toBe('3-4');
  expect(s.scenery).toEqual([]); // indoors: the lab's own wall
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(2);
});

test('3-4 leads straight into 3-5, the corridor to the boss', async ({ page }) => {
  await openSection(page, 'neon-4');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('neon-5');
  const s = await level(page);
  expect(s.label).toBe('3-5');
  expect(s.boss).toMatchObject({ type: 'mech', mode: 'waiting' });
});
