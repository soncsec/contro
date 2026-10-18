import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, waitGameTime, watchPage } from './watch';

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
  // At 300 px/s a bullet from x≈66 passes the view's edge plus margin (336 px) in about
  // 0.95 s of game time; allow 1.5 s.
  const fired = await level(page);
  const later = await waitGameTime(page, fired.timeMs, 1500);
  expect(later.bullets).toMatchObject({ fired: 1, active: 0, impacts: 0 });
  expect(watched.errors).toEqual([]);
});

test('holding fire for 2 s fires exactly one shot, in the braced shoot pose (issue #21)', async ({
  page,
}) => {
  await openLevel(page);
  await page.keyboard.down('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  const first = await level(page);
  expect(first.player.anim).toBe('shoot');
  const later = await waitGameTime(page, first.timeMs, 2000);
  expect(later.bullets.fired).toBe(1);
  expect(later.player.anim).toBe('shoot'); // still braced while the key is held
  await page.keyboard.up('KeyX');
  await expect.poll(async () => (await level(page)).player.anim).toBe('idle');
});

test('each new press fires again', async ({ page }) => {
  await openLevel(page);
  for (let shot = 1; shot <= 3; shot++) {
    await page.keyboard.press('KeyJ');
    await expect.poll(async () => (await level(page)).bullets.fired).toBe(shot);
    const s = await level(page);
    await waitGameTime(page, s.timeMs, 120); // past the 90 ms limit between shots
  }
});

test('running while holding fire keeps the run animation and fires once', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyJ');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  const first = await level(page);
  const snap = await waitGameTime(page, first.timeMs, 400);
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('ArrowRight');
  expect(snap.player.anim).toBe('run');
  expect(snap.bullets.fired).toBe(1);
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
