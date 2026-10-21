import { expect, test, type Page } from '@playwright/test';
import { WEAPON } from '../../src/config/tuning';
import { level, startGame, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

/** Fires one shot (a tap) and returns where it started. */
async function shoot(page: Page) {
  // A tap sooner than tapMinMs after the last shot is ignored. Under load the game clock runs
  // slowly, so let that much game time pass first.
  const now = await level(page);
  const before = (await waitGameTime(page, now.timeMs, WEAPON.tapMinMs)).bullets.fired;
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(before + 1);
  const shot = (await level(page)).bullets.lastShot;
  if (!shot) throw new Error('no shot recorded');
  return shot;
}

test('down crouches: the marine stops and shoots lower', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  const standing = await shoot(page);
  expect(standing.aim).toBe('forward');

  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await level(page)).player.anim).toBe('crouch');
  const start = await level(page);
  const later = await waitGameTime(page, start.timeMs, 300);
  expect(later.player).toMatchObject({ crouching: true, vx: 0, feetY: 160 });
  expect(later.player.x).toBe(start.player.x);

  // The crouched barrel is 9 px lower.
  const low = await shoot(page);
  expect(low.y - standing.y).toBe(9);

  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await level(page)).player.crouching).toBe(false);
  expect(watched.errors).toEqual([]);
});

test('down + right runs right aiming 45° down; letting go of right crouches again (M3.13)', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  const standing = await shoot(page);
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await level(page)).player.anim).toBe('crouch');

  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await level(page)).player.anim).toBe('run-down');
  expect((await level(page)).player).toMatchObject({ crouching: false, aim: 'down', vx: 90 });
  const shot = await shoot(page);
  expect(shot.aim).toBe('down');
  // The lowered barrel is well below the standing one.
  expect(shot.y).toBeGreaterThan(standing.y + 9);
  const fired = await level(page);
  expect(fired.bullets.firedDown).toBe(1);
  // Down and away: it leaves the view without stopping on the floor (M3.12).
  const gone = await waitGameTime(page, fired.timeMs, 1200);
  expect(gone.bullets.active).toBe(0);

  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await level(page)).player.anim).toBe('crouch');
  expect((await level(page)).player.vx).toBe(0);
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await level(page)).player.crouching).toBe(false);
  expect(watched.errors).toEqual([]);
});

test('holding fire while crouched uses the crouch-shoot pose and stays down after', async ({
  page,
}) => {
  await openLevel(page);
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('KeyX');
  await expect.poll(async () => (await level(page)).player.anim).toBe('crouch-shoot');
  await page.keyboard.up('KeyX');
  await expect.poll(async () => (await level(page)).player.anim).toBe('crouch');
  expect((await level(page)).player.crouching).toBe(true);
  await page.keyboard.up('ArrowDown');
});

test('up aims diagonally: the shot starts higher and flies up and away', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  const forward = await shoot(page);
  const t0 = await level(page);
  await waitGameTime(page, t0.timeMs, 120);

  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await level(page)).player.anim).toBe('aim-diag');
  const up = await shoot(page);
  expect(up.aim).toBe('diagonal');
  expect(up.y).toBeLessThan(forward.y - 5);
  expect(up.x).toBeLessThan(forward.x); // the raised rifle doesn't reach as far forward
  const fired = await level(page);
  expect(fired.bullets.firedDiagonal).toBe(1);

  // Up and away: it leaves through the top of the screen without hitting anything.
  const gone = await waitGameTime(page, fired.timeMs, 1200);
  expect(gone.bullets.active).toBe(0);
  await page.keyboard.up('ArrowUp');
  expect(watched.errors).toEqual([]);
});

test('running with up held uses the diagonal run', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await level(page)).player.anim).toBe('run-diag');
  expect((await level(page)).player.vx).toBe(90);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await level(page)).player.anim).toBe('aim-diag');
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await level(page)).player.anim).toBe('idle');
});
