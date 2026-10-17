import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

/** Fires one shot (a tap) and returns where it started. */
async function shoot(page: Page) {
  const before = (await level(page)).bullets.fired;
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(before + 1);
  const shot = (await level(page)).bullets.lastShot;
  if (!shot) throw new Error('no shot recorded');
  return shot;
}

test('down crouches: the marine stops, can still turn, and shoots lower', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  const standing = await shoot(page);
  expect(standing.aim).toBe('forward');

  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await level(page)).player.anim).toBe('crouch');
  // Holding right while crouched doesn't move him.
  await page.keyboard.down('ArrowRight');
  const start = await level(page);
  const later = await waitGameTime(page, start.timeMs, 300);
  expect(later.player).toMatchObject({ crouching: true, vx: 0, feetY: 160 });
  expect(later.player.x).toBe(start.player.x);
  await page.keyboard.up('ArrowRight');

  // The crouched barrel is 9 px lower.
  await waitGameTime(page, later.timeMs, 120);
  const low = await shoot(page);
  expect(low.y - standing.y).toBe(9);

  // He can turn while crouched.
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await level(page)).player.facing).toBe('left');
  await page.keyboard.up('ArrowLeft');
  expect((await level(page)).player.x).toBe(start.player.x);

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
  expect(gone.bullets.impacts).toBe(0);
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
