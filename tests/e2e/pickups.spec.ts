import { expect, test, type Page } from '@playwright/test';
import { WEAPONS } from '../../src/data/weapons';
import { level, nextSection, startGame, waitGameTime, watchPage } from './watch';

/**
 * Weapon blimps and pickups (M4.1). The test hook sends a blimp across the training corridor
 * at the height of the marine's forward shots; he shoots it down and walks into its letter.
 */
test.describe.configure({ timeout: 120_000 });

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

/** Sends a blimp, shoots it down, and walks into the letter. Resolves once it is collected. */
async function collect(page: Page, weapon: 'machine-gun' | 'spread'): Promise<void> {
  const s = await level(page);
  // Blimp hull centre at the barrel's height: forward shots start about 25 px above the feet.
  await page.evaluate(({ w, y }) => window.__contro?.spawnBlimp(w, y), {
    w: weapon,
    y: s.player.feetY - 26,
  });
  await expect.poll(async () => (await level(page)).blimps.length).toBe(1);
  // Tap fire until it bursts.
  await expect
    .poll(
      async () => {
        const now = await level(page);
        if (now.blimps.length === 0) return 'down';
        await page.keyboard.press('KeyX');
        return 'flying';
      },
      { timeout: 60_000, intervals: [120] },
    )
    .toBe('down');
  // The letter lands; walk right into it.
  await expect
    .poll(async () => (await level(page)).pickups[0]?.onFloor ?? false, { timeout: 15_000 })
    .toBe(true);
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await level(page)).player.weapon, { timeout: 30_000 })
    .toBe(weapon);
  await page.keyboard.up('ArrowRight');
  expect((await level(page)).pickups).toEqual([]);
}

test('shooting down a blimp drops its letter; walking into M gives the machine gun', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  expect((await level(page)).player.weapon).toBe('rifle');
  const before = (await level(page)).score.score;
  await collect(page, 'machine-gun');
  expect((await level(page)).score.score).toBeGreaterThanOrEqual(before + 500); // the blimp's points

  // Holding fire keeps firing: one shot per autoIntervalMs of game time.
  await page.keyboard.down('KeyX');
  const start = await level(page);
  const later = await waitGameTime(page, start.timeMs, 1000);
  await page.keyboard.up('KeyX');
  const expected = (later.timeMs - start.timeMs) / WEAPONS['machine-gun'].autoIntervalMs;
  expect(later.bullets.fired - start.bullets.fired).toBeGreaterThanOrEqual(
    Math.floor(expected) - 2,
  );
  expect(watched.errors).toEqual([]);
});

test('the spread fires three bullets per press', async ({ page }) => {
  await openLevel(page);
  await collect(page, 'spread');
  const before = await level(page);
  await waitGameTime(page, before.timeMs, 400);
  const ready = await level(page);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(ready.bullets.fired + 1);
  expect((await level(page)).bulletsFired).toBe(ready.bulletsFired + 3);
});

test('the weapon carries into the next section, and losing a life loses it', async ({ page }) => {
  await openLevel(page);
  await collect(page, 'machine-gun');
  await nextSection(page);
  const next = await level(page);
  expect(next.level).toBe('corridor-test-2');
  expect(next.player.weapon).toBe('machine-gun');

  await page.evaluate(() => window.__contro?.hurtPlayer(99));
  await expect.poll(async () => (await level(page)).player.dead).toBe(true);
  await expect.poll(async () => (await level(page)).player.dead, { timeout: 15_000 }).toBe(false);
  expect((await level(page)).player.weapon).toBe('rifle');
});
