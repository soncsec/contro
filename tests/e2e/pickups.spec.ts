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
async function collect(page: Page, carries: 'machine-gun' | 'spread' | 'health'): Promise<void> {
  const s = await level(page);
  // Blimp hull centre at the barrel's height: forward shots start about 25 px above the feet.
  await page.evaluate(({ w, y }) => window.__contro?.spawnBlimp(w, y), {
    w: carries,
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
  await expect.poll(async () => (await level(page)).pickups.length, { timeout: 30_000 }).toBe(0);
  await page.keyboard.up('ArrowRight');
  if (carries !== 'health') expect((await level(page)).player.weapon).toBe(carries);
}

/**
 * Turns on IRON (invincible) from the pause screen. The training corridor's walkers can reach
 * the marine while a slow machine runs a test, and a hit stuns him so a fire press is ignored;
 * tests about weapons and pickups, not dodging, switch it on first.
 */
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

test('shooting down a blimp drops its letter; walking into M gives the machine gun', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  await iron(page);
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
  // At most one shot per frame: on a loaded machine long frames drop the real rate a little
  // below one per 100 ms, so allow 70% of it (still far above the rifle's single shot).
  expect(later.bullets.fired - start.bullets.fired).toBeGreaterThanOrEqual(
    Math.floor(expected * 0.7),
  );
  expect(watched.errors).toEqual([]);
});

test('the spread fires three bullets per press', async ({ page }) => {
  await openLevel(page);
  await iron(page);
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

test('holding fire with the machine gun keeps firing into the next section (M7.2)', async ({
  page,
}) => {
  await openLevel(page);
  await iron(page);
  await collect(page, 'machine-gun');
  // Fire is held down through the exit and never pressed again.
  await page.keyboard.down('KeyX');
  await nextSection(page);
  const start = await level(page);
  expect(start.level).toBe('corridor-test-2');
  const later = await waitGameTime(page, start.timeMs, 1000);
  expect(later.bullets.fired - start.bullets.fired).toBeGreaterThanOrEqual(3);
  await page.keyboard.up('KeyX');
});

test('Level 1 section 1-3 sends a machine-gun blimp once its point is in view', async ({
  page,
}) => {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => window.__contro?.title()?.ready), { timeout: 15_000 })
    .toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('steelworks-3'));
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
  expect((await level(page)).blimps).toEqual([]);
  // The blimp point is at column 44 (x 704): stand where it is on screen.
  await page.evaluate(() => window.__contro?.teleportPlayer(600));
  await expect
    .poll(async () => (await level(page)).blimps.map((b) => b.carries), { timeout: 15_000 })
    .toEqual(['machine-gun']);
});

test('a blimp nobody shoots flies across and off the screen, and is gone', async ({ page }) => {
  await openLevel(page);
  const s = await level(page);
  await page.evaluate((y) => window.__contro?.spawnBlimp('spread', y), s.player.feetY - 90);
  await expect.poll(async () => (await level(page)).blimps.length).toBe(1);
  const first = (await level(page)).blimps[0];
  // It comes in from the right and heads left, across the whole screen.
  await expect
    .poll(async () => (await level(page)).blimps[0]?.x ?? -1, { timeout: 15_000 })
    .toBeLessThan((first?.x ?? 0) - 40);
  // ...then off the left edge, gone for good: no letter is left behind.
  await expect.poll(async () => (await level(page)).blimps.length, { timeout: 60_000 }).toBe(0);
  expect((await level(page)).pickups).toEqual([]);
});

test('a health blimp drops a red cross that restores full health (owner request)', async ({
  page,
}) => {
  await openLevel(page);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__contro?.hurtPlayer(1));
    const now = await level(page);
    await waitGameTime(page, now.timeMs, 1600); // past the invulnerability
  }
  expect((await level(page)).player.hp).toBe(2);
  // IRON from here, so the walkers can't hurt him on his way to the cross.
  await iron(page);
  await collect(page, 'health');
  const after = await level(page);
  expect(after.player.hp).toBe(4);
  expect(after.player.weapon).toBe('rifle'); // health doesn't change the weapon
});
