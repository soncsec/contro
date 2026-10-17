import { expect, test, type Page } from '@playwright/test';
import type { LevelSnapshot } from '../../src/scenes/LevelScene';
import { sceneKey, watchPage } from './watch';

const VIEW_WIDTH = 320;

async function level(page: Page): Promise<LevelSnapshot> {
  const snap = await page.evaluate(() => window.__contro?.level() ?? null);
  if (!snap) throw new Error('no level is running');
  return snap;
}

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
}

test('the player lands on the corridor floor at the start', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const snap = await level(page);
  expect(snap.level).toBe('corridor-test');
  expect(snap.player.feetY).toBe(160); // the floor line in corridor-test.tmj
  expect(snap.cameraX).toBe(0); // the start is near the left edge
  expect(watched.errors).toEqual([]);
});

test('the camera follows the player and stops at the level edges', async ({ page }) => {
  await openLevel(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const { widthPx } = await level(page);

  // Middle of the level: the player is centred on screen.
  await page.evaluate(() => window.__contro?.teleportPlayer(600));
  await expect.poll(async () => (await level(page)).cameraX).toBe(600 - VIEW_WIDTH / 2);

  // Right end: the camera stops so it never shows past the level.
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), widthPx - 20);
  await expect.poll(async () => (await level(page)).cameraX).toBe(widthPx - VIEW_WIDTH);
  // Still standing on the floor after a moment (no falling through).
  await page.waitForTimeout(500);
  expect((await level(page)).player).toMatchObject({ feetY: 160, onFloor: true });

  // Back to the left end.
  await page.evaluate(() => window.__contro?.teleportPlayer(20));
  await expect.poll(async () => (await level(page)).cameraX).toBe(0);
  await page.waitForTimeout(500);
  expect((await level(page)).player).toMatchObject({ feetY: 160, onFloor: true });
});

test('the test hook rejects a teleport that is not a number', async ({ page }) => {
  await openLevel(page);
  const error = await page.evaluate(() => {
    try {
      window.__contro?.teleportPlayer(Number.NaN);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(error).toBe('teleportPlayer needs a number, got NaN');
});
