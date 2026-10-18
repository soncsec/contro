import { expect, test, type Page } from '@playwright/test';
import { level, startGame, waitGameTime, watchPage } from './watch';

// Room 1's flyer hovers around (680, 70), drifting 64 px either side.
const FLYER = { x: 680, y: 70 };

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

async function flyer(page: Page) {
  const e = (await level(page)).enemies.find((x) => x.type === 'alien-flyer');
  if (!e) throw new Error('no flyer in this room');
  return e;
}

/** Watches the flyer every frame for `ms` of game time; returns what was seen. */
function watchFlyer(page: Page, ms: number) {
  return page.evaluate(async (duration) => {
    const modes: string[] = [];
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    let start: number | null = null;
    for (;;) {
      const snap = window.__contro?.level();
      const f = snap?.enemies.find((e) => e.type === 'alien-flyer');
      if (snap && f) {
        start ??= snap.timeMs;
        if (modes[modes.length - 1] !== f.mode && f.mode) modes.push(f.mode);
        minX = Math.min(minX, f.x);
        maxX = Math.max(maxX, f.x);
        minY = Math.min(minY, f.y);
        maxY = Math.max(maxY, f.y);
        if (snap.timeMs - start >= duration) break;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { modes, minX, maxX, minY, maxY };
  }, ms);
}

test('the flyer hovers around its spawn point without falling', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  // The marine stays at the start, far out of its range.
  const seen = await watchFlyer(page, 4000);
  expect(seen.modes).toEqual(['hover']);
  expect(seen.minX).toBeGreaterThanOrEqual(FLYER.x - 64 - 2);
  expect(seen.maxX).toBeLessThanOrEqual(FLYER.x + 64 + 2);
  expect(seen.minY).toBeGreaterThanOrEqual(FLYER.y - 10);
  expect(seen.maxY).toBeLessThanOrEqual(FLYER.y + 10);
  expect((await level(page)).enemyShots.fired).toBe(0);
  expect(watched.errors).toEqual([]);
});

test('in range, the flyer fires aimed orbs that hurt the marine', async ({ page }) => {
  await openLevel(page);
  // About 140 px from the flyer: inside its 220 px firing range, outside its dive range.
  await page.evaluate(() => window.__contro?.teleportPlayer(560));
  const start = await level(page);
  await expect
    .poll(async () => (await level(page)).enemyShots.fired, { timeout: 15_000 })
    .toBeGreaterThan(0);
  // An orb flies at him (80 px/s) and he doesn't move, so it lands.
  await expect.poll(async () => (await level(page)).player.hp, { timeout: 15_000 }).toBeLessThan(4);
  expect(start.player.hp).toBe(4);
});

test('with the marine below, it pauses to warn, dives at him, then rises back', async ({
  page,
}) => {
  await openLevel(page);
  // Put the marine under the flyer and keep him there.
  const f = await flyer(page);
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), f.x);
  const seen = await watchFlyer(page, 6000);
  // hover → windup (warning) → dive → rise → hover, at least once.
  const sequence = seen.modes.join(' > ');
  expect(sequence).toContain('hover > windup > dive > rise > hover');
  // It came down to the marine (his body centre is at y≈143) and went back up.
  expect(seen.maxY).toBeGreaterThan(120);
  expect(seen.minY).toBeLessThanOrEqual(FLYER.y + 10);
});

test('the flyer takes two hits and dies', async ({ page }) => {
  await openLevel(page);
  // Diagonal shots from just left of the flyer's path cross its height as it drifts.
  await page.evaluate(() => window.__contro?.teleportPlayer(600));
  await page.keyboard.down('ArrowUp');
  // One shot per press, so keep tapping fire until it's down.
  for (let i = 0; i < 150 && (await flyer(page)).alive; i++) {
    await page.keyboard.press('KeyX');
    const s = await level(page);
    await waitGameTime(page, s.timeMs, 110);
  }
  await page.keyboard.up('ArrowUp');
  expect((await flyer(page)).alive).toBe(false);
  expect((await flyer(page)).hp).toBe(0);
});
