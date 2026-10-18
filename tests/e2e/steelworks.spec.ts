import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, title, walkThroughExit, watchPage } from './watch';

/** Opens the game and jumps straight to a section of the steelworks (M3.1). */
async function openSection(page: Page, key: string): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate((k) => window.__contro?.startLevel(k), key);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.level()?.level ?? null), { timeout: 15_000 })
    .toBe(key);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const openYard = (page: Page) => openSection(page, 'steelworks-1');

test('the steelworks yard loads with its skyline, and the marine stands on the steel', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openYard(page);
  const s = await level(page);
  expect(s.scenery).toEqual([
    'industrial-sky',
    'industrial-far',
    'industrial-mid',
    'industrial-near',
  ]);
  // In the e2e build the training corridor is level 1, so the steelworks is level 2 here.
  expect(s.label).toBe('2-1');
  expect(s.player.feetY).toBe(136);
  expect(s.widthPx).toBe(180 * 16);
  expect(s.enemies.filter((e) => e.type === 'alien-walker')).toHaveLength(12);
  expect(s.enemies.filter((e) => e.type === 'alien-flyer')).toHaveLength(4);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('the yard leads straight into the steelworks interior, with no card', async ({ page }) => {
  await openYard(page);
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('steelworks-2');
  expect((await level(page)).label).toBe('2-2');
});

test('the interior loads indoors, with no skyline, and the marine stands on the steel', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openSection(page, 'steelworks-2');
  const s = await level(page);
  expect(s.scenery).toEqual([]); // the piped wall is part of the map
  expect(s.label).toBe('2-2');
  expect(s.player.feetY).toBe(136);
  expect(s.widthPx).toBe(170 * 16);
  expect(s.enemies.filter((e) => e.type === 'alien-walker')).toHaveLength(16);
  expect(s.enemies.filter((e) => e.type === 'alien-flyer')).toHaveLength(5);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('the interior ends with the level-end card, then the campaign starts again', async ({
  page,
}) => {
  await openSection(page, 'steelworks-2');
  const exit = await walkThroughExit(page);
  expect(exit.scene).toBe('Dialogue');
  // The last section so far: after its card the campaign starts again from the beginning.
  expect(await page.evaluate(() => window.__contro?.dialogue())).toMatchObject({
    card: 'level-1-end',
    nextLevel: 'corridor-test',
  });
  expect(await sceneKey(page)).toBe('Dialogue');
});
