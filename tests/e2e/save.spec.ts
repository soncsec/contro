import { expect, test, type Page } from '@playwright/test';
import { dialogue, level, sceneKey, title, watchPage } from './watch';

/**
 * Save data and the title's level select (M3.5). In the e2e build the training corridor is
 * level 1 and the steelworks level 2.
 */
const SAVE_KEY = 'contro.save.v1';
const saved = async (page: Page) =>
  JSON.parse((await page.evaluate((k) => window.localStorage.getItem(k), SAVE_KEY)) ?? '{}');

async function openTitle(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
}

test('reaching level 2 is saved, and the title then offers it', async ({ page }) => {
  const watched = watchPage(page);
  await openTitle(page);
  await page.evaluate(() => window.__contro?.startLevel('steelworks-1'));
  await expect
    .poll(async () => (await level(page)).level, { timeout: 15_000 })
    .toBe('steelworks-1');
  expect(await saved(page)).toMatchObject({ furthestLevel: 2 });

  await openTitle(page);
  expect(await title(page)).toMatchObject({
    options: ['START', 'LEVEL', 'CONTROLS', 'MORE GAMES'],
    level: 2, // the furthest level reached is chosen
  });
  expect(watched.errors).toEqual([]);
});

test('LEVEL picks a reached level with left and right, and START begins there', async ({
  page,
}) => {
  await openTitle(page);
  await page.evaluate(
    (k) =>
      window.localStorage.setItem(
        k,
        JSON.stringify({ version: 1, bestScore: 0, furthestLevel: 2 }),
      ),
    SAVE_KEY,
  );
  await openTitle(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await title(page))?.option).toBe('LEVEL');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await title(page))?.level).toBe(1);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await title(page))?.level).toBe(2);

  // Level 2 opens with its intro card, then its first section.
  await page.keyboard.press('KeyX');
  await expect
    .poll(async () => (await dialogue(page))?.card, { timeout: 15_000 })
    .toBe('level-1-intro');
  await expect.poll(async () => (await dialogue(page))?.ready).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  expect((await level(page)).label).toBe('2-1');
});

test('a save from a longer game never offers a level this build does not have', async ({
  page,
}) => {
  await openTitle(page);
  await page.evaluate(
    (k) =>
      window.localStorage.setItem(
        k,
        JSON.stringify({ version: 1, bestScore: 0, furthestLevel: 9 }),
      ),
    SAVE_KEY,
  );
  await openTitle(page);
  expect((await title(page))?.level).toBe(4); // training, the steelworks, the Neon District, the hive
});

test('a cheated run does not unlock levels', async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press('Space');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  // THRU skips a section: twice leaves level 1, through its cards into level 2.
  const skip = async () => {
    await page.keyboard.press('Escape');
    await expect.poll(() => sceneKey(page)).toBe('Pause');
    for (const k of ['KeyT', 'KeyH', 'KeyR', 'KeyU']) await page.keyboard.press(k);
  };
  await skip();
  await expect
    .poll(async () => (await level(page)).level, { timeout: 15_000 })
    .toBe('corridor-test-2');
  await skip();
  for (const card of ['training-end', 'level-1-intro']) {
    await expect.poll(async () => (await dialogue(page))?.card, { timeout: 15_000 }).toBe(card);
    await expect.poll(async () => (await dialogue(page))?.ready).toBe(true);
    await page.keyboard.press('KeyX');
  }
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  expect((await level(page)).level).toBe('steelworks-1');
  expect((await level(page)).cheats.used).toBe(true);
  expect((await saved(page)).furthestLevel ?? 1).toBe(1);
});
