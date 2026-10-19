import { expect, test, type Page } from '@playwright/test';
import { level, startGame, waitGameTime, watchPage } from './watch';

/**
 * The bipedal walker (M4.2). The test hook puts one on the training corridor's floor ahead of
 * the marine, facing him.
 */
test.describe.configure({ timeout: 120_000 });

const walker = async (page: Page) =>
  (await level(page)).enemies.find((e) => e.type === 'bipedal-walker');

async function openWithWalker(page: Page, x = 260): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  await page.evaluate((at) => window.__contro?.placeEnemy('bipedal-walker', at), x);
  await expect.poll(async () => (await walker(page))?.alive).toBe(true);
}

test('it fires at head height: a standing marine is hit, a crouching one is not', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openWithWalker(page);
  // Crouched: its shots pass over him.
  await page.keyboard.down('ArrowDown');
  const start = await level(page);
  const crouched = await waitGameTime(page, start.timeMs, 3500);
  expect(crouched.enemyShots.fired).toBeGreaterThan(start.enemyShots.fired);
  expect(crouched.player.hp).toBe(start.player.hp);
  await page.keyboard.up('ArrowDown');
  // Standing: the next shot hits.
  await expect
    .poll(async () => (await level(page)).player.hp, { timeout: 30_000 })
    .toBeLessThan(start.player.hp);
  expect(watched.errors).toEqual([]);
});

test('it takes six hits and is worth 400 points', async ({ page }) => {
  await openWithWalker(page, 200);
  const before = (await level(page)).score.score;
  const hp: number[] = [];
  await expect
    .poll(
      async () => {
        const w = await walker(page);
        if (!w?.alive) return 'down';
        if (hp[hp.length - 1] !== w.hp) hp.push(w.hp);
        await page.keyboard.press('KeyX');
        return 'up';
      },
      { timeout: 60_000, intervals: [130] },
    )
    .toBe('down');
  expect(hp[0]).toBe(6);
  expect((await level(page)).score.score).toBe(before + 400);
});

test('it walks towards the marine', async ({ page }) => {
  await openWithWalker(page, 300);
  const first = await walker(page);
  const s = await level(page);
  await waitGameTime(page, s.timeMs, 3500);
  const later = await walker(page);
  expect(later?.facing).toBe('left');
  expect(later?.x ?? 0).toBeLessThan((first?.x ?? 0) - 10);
});
