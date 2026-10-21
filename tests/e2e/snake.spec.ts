import { expect, test, type Page } from '@playwright/test';
import { level, startGame, waitGameTime, watchPage } from './watch';

/**
 * The spitting snake (M5.1). The test hook puts one on the training corridor's floor ahead of
 * the marine.
 */
test.describe.configure({ timeout: 120_000 });

const snake = async (page: Page) =>
  (await level(page)).enemies.find((e) => e.type === 'spitting-snake');

async function openWithSnake(page: Page, x: number): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  await page.evaluate((at) => window.__contro?.placeEnemy('spitting-snake', at), x);
  await expect.poll(async () => (await snake(page))?.alive).toBe(true);
}

/** IRON (invincible) from the pause screen: a hit's stun would swallow fire presses. */
async function iron(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  for (const k of ['KeyI', 'KeyR', 'KeyO', 'KeyN']) await page.keyboard.press(k);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.cheatMessage() ?? null))
    .toBe('INVINCIBLE ON');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();
}

test('it sits still, faces the marine and spits at him; a glob hurts', async ({ page }) => {
  const watched = watchPage(page);
  await openWithSnake(page, 220);
  const first = await snake(page);
  expect(first?.facing).toBe('left');
  const start = await level(page);
  await expect
    .poll(async () => (await level(page)).player.hp, { timeout: 30_000 })
    .toBeLessThan(start.player.hp);
  const later = await level(page);
  expect(later.enemyShots.fired).toBeGreaterThan(start.enemyShots.fired);
  // It never moves from its spot.
  expect((await snake(page))?.x).toBe(first?.x);
  expect(watched.errors).toEqual([]);
});

test('it spits again and again while he stays in sight', async ({ page }) => {
  await openWithSnake(page, 220);
  await iron(page);
  const start = await level(page);
  // About one glob every 2 s (0.4 s rearing back, 1.6 s resting).
  const later = await waitGameTime(page, start.timeMs, 4500);
  expect(later.enemyShots.fired - start.enemyShots.fired).toBeGreaterThanOrEqual(2);
});

test('it is too low for a standing shot: crouch to hit it; two hits, 150 points', async ({
  page,
}) => {
  await openWithSnake(page, 200);
  await iron(page);
  const before = (await level(page)).score.score;
  // Standing, the rifle's shots fly over its head.
  for (let i = 0; i < 4; i++) {
    const s = await level(page);
    await page.keyboard.press('KeyX');
    await waitGameTime(page, s.timeMs, 400);
  }
  expect((await level(page)).bullets.fired).toBeGreaterThanOrEqual(4);
  expect((await snake(page))?.hp).toBe(2);
  // Crouched, they hit it.
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(
      async () => {
        const sn = await snake(page);
        if (!sn?.alive) return 'down';
        await page.keyboard.press('KeyX');
        return 'up';
      },
      { timeout: 30_000, intervals: [200] },
    )
    .toBe('down');
  await page.keyboard.up('ArrowDown');
  expect((await level(page)).score.score).toBe(before + 150);
});

test("a placed enemy's position is right at once, before the next frame", async ({ page }) => {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  // Place it and read it in the same call, so no frame runs in between: the body must already
  // be where its box is (it used to lag by its box offset until the next physics step).
  const x = await page.evaluate(() => {
    window.__contro?.placeEnemy('spitting-snake', 220);
    const snakes = window.__contro?.level()?.enemies.filter((e) => e.type === 'spitting-snake');
    return snakes?.[snakes.length - 1]?.x ?? null;
  });
  expect(x).toBe(220);
  // And it doesn't jump on the next frames either.
  const s = await level(page);
  await waitGameTime(page, s.timeMs, 300);
  expect((await snake(page))?.x).toBe(220);
});
