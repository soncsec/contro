import { expect, test, type Page } from '@playwright/test';
import type { LevelSnapshot } from '../../src/scenes/LevelScene';
import { sceneKey, watchPage } from './watch';

async function level(page: Page): Promise<LevelSnapshot> {
  const snap = await page.evaluate(() => window.__contro?.level() ?? null);
  if (!snap) throw new Error('no level is running');
  return snap;
}

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

test('a tap fires one bullet that flies off screen without an impact', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  // 300 px/s from x≈66 leaves the 320 px view in about a second.
  await expect.poll(async () => (await level(page)).bullets.active, { timeout: 3000 }).toBe(0);
  expect((await level(page)).bullets.impacts).toBe(0);
  expect(watched.errors).toEqual([]);
});

/** Waits until the game clock has advanced `ms` past `fromMs`. */
async function waitGameTime(page: Page, fromMs: number, ms: number): Promise<LevelSnapshot> {
  await expect.poll(async () => (await level(page)).timeMs - fromMs).toBeGreaterThanOrEqual(ms);
  return level(page);
}

test('holding fire shoots every 160 ms of game time in the braced shoot pose', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.down('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  const first = await level(page);
  expect(first.player.anim).toBe('shoot');
  const later = await waitGameTime(page, first.timeMs, 960);
  await page.keyboard.up('KeyX');
  // Game time is measured from the first shot, so 960 ms adds 6 more shots (±1 for frame edges).
  const extra = later.bullets.fired - 1;
  const expected = Math.floor((later.timeMs - first.timeMs) / 160);
  expect(Math.abs(extra - expected)).toBeLessThanOrEqual(1);
  await expect.poll(async () => (await level(page)).player.anim).toBe('idle');
});

test('running while firing keeps the run animation', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyJ');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  const first = await level(page);
  const snap = await waitGameTime(page, first.timeMs, 400);
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('ArrowRight');
  expect(snap.player.anim).toBe('run');
  expect(snap.bullets.fired).toBeGreaterThanOrEqual(3); // shots at 0, 160 and 320 ms
});

test('a bullet fired into the level wall makes an impact', async ({ page }) => {
  await openLevel(page);
  // Face left at the start: the level's left edge is about 50 px away.
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(50);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await level(page)).player.facing).toBe('left');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.impacts).toBe(1);
  expect((await level(page)).bullets.active).toBe(0);
});

test('fast tapping never puts more than 8 bullets on screen', async ({ page }) => {
  await openLevel(page);
  let most = 0;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(70);
    most = Math.max(most, (await level(page)).bullets.active);
  }
  expect(most).toBeGreaterThan(1);
  expect(most).toBeLessThanOrEqual(8);
});
