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

test('4-1 leads straight into 4-2, with no card', async ({ page }) => {
  await openSection(page, 'hive-1');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('hive-2');
  expect((await level(page)).label).toBe('4-2');
});

test('4-2 is deeper in the base, on two levels, with snakes up high and two bipedal walkers', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openSection(page, 'hive-2');
  const s = await level(page);
  expect(s.label).toBe('4-2');
  expect(s.scenery).toEqual(['alien-back', 'alien-structures']);
  expect(s.widthPx).toBe(170 * 16);
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(2);
  const snakes = s.enemies.filter((e) => e.type === 'spitting-snake');
  expect(snakes).toHaveLength(5);
  expect(snakes.every((e) => e.feetY < 100)).toBe(true); // on the high bridges
  expect(watched.errors).toEqual([]);
});

test("4-2's exit leads into the base's core, an into-the-screen base stage", async ({ page }) => {
  await openSection(page, 'hive-2');
  const { exitX } = await level(page);
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), exitX - 20);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => sceneKey(page), { timeout: 30_000 }).toBe('Base');
  await page.keyboard.up('ArrowRight');
  const base = await page.evaluate(() => window.__contro?.base());
  expect(base?.section).toBe('hive-core');
});

test('after the base core comes 4-4, inside the hive: indoors, flesh ledges and snakes', async ({
  page,
}) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('hive-core'));
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Base');
  // THRU through every room of the base core.
  while ((await sceneKey(page)) === 'Base') {
    await page.keyboard.press('Escape');
    const paused = await page
      .waitForFunction(() => window.__contro?.pauseMenu() === 'RESUME', null, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!paused) break;
    for (const k of ['KeyT', 'KeyH', 'KeyR', 'KeyU']) await page.keyboard.press(k);
    await page.waitForTimeout(2500);
  }
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('hive-3');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const s = await level(page);
  expect(s.label).toBe('4-4');
  expect(s.scenery).toEqual([]); // indoors: the hive's flesh wall
  expect(s.player.feetY).toBe(132); // the crest's top at 128, feet 4 px into it
  expect(s.enemies.filter((e) => e.type === 'spitting-snake')).toHaveLength(7);
  expect(s.enemies.filter((e) => e.type === 'bipedal-walker')).toHaveLength(0);
  expect(watched.errors).toEqual([]);
});

test("4-4 leads straight into 4-5, the hive's gut: two levels, the most snakes yet", async ({
  page,
}) => {
  await openSection(page, 'hive-3');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('hive-4');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const s = await level(page);
  expect(s.label).toBe('4-5');
  expect(s.widthPx).toBe(180 * 16);
  expect(s.scenery).toEqual([]);
  const snakes = s.enemies.filter((e) => e.type === 'spitting-snake');
  expect(snakes).toHaveLength(7);
  expect(snakes.every((e) => e.feetY < 128)).toBe(true); // up on the ledges, above the floor
});

test("4-5 leads straight into 4-6, the hive's heart, where the demon waits", async ({ page }) => {
  await openSection(page, 'hive-4');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('hive-5');
  const s = await level(page);
  expect(s.label).toBe('4-6');
  expect(s.boss).toMatchObject({ type: 'demon', mode: 'waiting' });
});
