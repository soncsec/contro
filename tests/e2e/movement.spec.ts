import { expect, test, type Page } from '@playwright/test';
import type { LevelSnapshot } from '../../src/scenes/LevelScene';
import { sceneKey, watchPage } from './watch';

async function player(page: Page): Promise<LevelSnapshot['player']> {
  const snap = await page.evaluate(() => window.__contro?.level() ?? null);
  if (!snap) throw new Error('no level is running');
  return snap.player;
}

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await player(page)).onFloor).toBe(true);
}

/** Samples the player's feet every frame for `ms` and returns the highest point reached. */
function highestFeetY(page: Page, ms: number): Promise<number> {
  return page.evaluate(async (duration) => {
    let min = Number.POSITIVE_INFINITY;
    const start = performance.now();
    while (performance.now() - start < duration) {
      const y = window.__contro?.level()?.player.feetY;
      if (y !== undefined) min = Math.min(min, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return min;
  }, ms);
}

test('arrow keys run right and left, and the marine turns to face the way he runs', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  const start = await player(page);
  expect(start).toMatchObject({ facing: 'right', anim: 'idle', vx: 0 });

  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await player(page)).anim).toBe('run');
  await page.waitForTimeout(500);
  const running = await player(page);
  expect(running).toMatchObject({ facing: 'right', vx: 90, onFloor: true, feetY: 160 });
  expect(running.x).toBeGreaterThan(start.x + 30);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await player(page)).anim).toBe('idle');
  expect((await player(page)).vx).toBe(0);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(300);
  const back = await player(page);
  await page.keyboard.up('ArrowLeft');
  expect(back).toMatchObject({ facing: 'left', vx: -90 });
  expect(back.x).toBeLessThan(running.x);
  expect(watched.errors).toEqual([]);
});

test('WASD moves the marine too', async ({ page }) => {
  await openLevel(page);
  const start = await player(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  expect((await player(page)).x).toBeGreaterThan(start.x + 20);
});

test('holding jump gives a full jump about one marine tall, then he lands', async ({ page }) => {
  await openLevel(page);
  const sampling = highestFeetY(page, 1200);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await player(page)).anim).toBe('jump');
  const top = await sampling;
  await page.keyboard.up('Space');
  // Apex = 300² / (2 × 900) = 50 px above the floor at y=160.
  expect(160 - top).toBeGreaterThanOrEqual(44);
  expect(160 - top).toBeLessThanOrEqual(52);
  await expect.poll(async () => (await player(page)).onFloor).toBe(true);
  expect(await player(page)).toMatchObject({ feetY: 160, anim: 'idle' });
});

test('tapping jump gives a short hop', async ({ page }) => {
  await openLevel(page);
  const sampling = highestFeetY(page, 1000);
  await page.keyboard.down('Space');
  await page.waitForTimeout(60);
  await page.keyboard.up('Space');
  const top = await sampling;
  expect(160 - top).toBeGreaterThan(5);
  expect(160 - top).toBeLessThan(35);
  await expect.poll(async () => (await player(page)).onFloor).toBe(true);
});

test('the marine cannot run off the left edge of the level', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1200);
  const p = await player(page);
  await page.keyboard.up('ArrowLeft');
  expect(p.x).toBe(8); // half the 16 px body: pressed against the wall
  expect(p.feetY).toBe(160);
});
