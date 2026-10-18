import { expect, test, type Page } from '@playwright/test';
import { level, startGame, waitGameTime, watchPage } from './watch';

// Room 1: low catwalk x 176–304 (deck y 119), high catwalk x 336–416 (deck y 87),
// pit gap x 844–884, checkpoint x 560.
const LOW = 119;
const HIGH = 87;
const FLOOR = 160;

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const player = async (page: Page) => (await level(page)).player;
const teleport = (page: Page, x: number) =>
  page.evaluate((v) => window.__contro?.teleportPlayer(v), x);

/** Waits until the marine is standing still on something, and returns where his feet are. */
async function landed(page: Page): Promise<number> {
  await expect
    .poll(
      async () => {
        const p = await player(page);
        return p.onFloor && p.vy === 0;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  return (await player(page)).feetY;
}

/** Jumps (holding the key for a full jump) while holding `dir` if given. */
async function jump(page: Page, dir?: 'ArrowRight' | 'ArrowLeft'): Promise<void> {
  if (dir) await page.keyboard.down(dir);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await player(page)).onFloor).toBe(false);
  await landed(page);
  await page.keyboard.up('Space');
  if (dir) await page.keyboard.up(dir);
}

test('he can climb from the floor to the low catwalk, then the high one', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  await teleport(page, 190);
  await landed(page);
  // Jump straight up under the low catwalk: he passes up through it and lands on top.
  await jump(page);
  expect(await player(page)).toMatchObject({ feetY: LOW, onPlatform: true });

  // From its right end, a running jump reaches the high catwalk.
  await teleport(page, 296);
  await jump(page, 'ArrowRight');
  const p = await player(page);
  expect(p).toMatchObject({ feetY: HIGH, onPlatform: true });
  expect(p.x).toBeGreaterThan(336);
  expect(watched.errors).toEqual([]);
});

test('the high catwalk is out of reach from the floor', async ({ page }) => {
  await openLevel(page);
  await teleport(page, 376);
  await landed(page);
  await jump(page);
  expect((await player(page)).feetY).toBe(FLOOR);
});

test('down + jump drops through a catwalk', async ({ page }) => {
  await openLevel(page);
  await teleport(page, 220);
  await landed(page);
  await jump(page);
  expect((await player(page)).feetY).toBe(LOW);

  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await player(page)).crouching).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await player(page)).feetY).toBe(FLOOR);
  await page.keyboard.up('ArrowDown');
  expect((await player(page)).onPlatform).toBe(false);
});

test('bullets fly up through catwalks without hitting them', async ({ page }) => {
  await openLevel(page);
  await teleport(page, 200);
  await landed(page);
  await page.keyboard.down('ArrowUp');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.firedDiagonal).toBe(1);
  const fired = await level(page);
  const later = await waitGameTime(page, fired.timeMs, 1200);
  await page.keyboard.up('ArrowUp');
  expect(later.bullets).toMatchObject({ active: 0, impacts: 0 });
});

test('falling into the pit costs a life and respawns him at the checkpoint', async ({ page }) => {
  await openLevel(page);
  const start = await level(page);
  const offset = start.respawnAt.x - start.player.x; // body centre vs spawn point
  await teleport(page, 820);
  await expect.poll(async () => (await level(page)).respawnAt.x).toBe(560);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await player(page)).dead, { timeout: 10_000 }).toBe(true);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await player(page)).dead, { timeout: 10_000 }).toBe(false);
  const back = await player(page);
  expect(back).toMatchObject({ lives: 2, hp: 4 });
  expect(back.x).toBe(560 - offset);
  await landed(page);
  expect((await player(page)).feetY).toBe(FLOOR);
});

test('a pit kills even straight after a hit, while invulnerable', async ({ page }) => {
  await openLevel(page);
  await teleport(page, 830);
  await page.evaluate(() => window.__contro?.hurtPlayer(1));
  expect((await player(page)).invulnerable).toBe(true);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await player(page)).dead, { timeout: 10_000 }).toBe(true);
  await page.keyboard.up('ArrowRight');
});

test('a running jump clears the pit', async ({ page }) => {
  await openLevel(page);
  await teleport(page, 780);
  await landed(page);
  // Take off with the body still on the near side (centre between about 816 and 852). The
  // press happens inside the page in the frame he reaches 824: polling from outside can be
  // late on a busy machine and run him into the pit. Jump stays held for a full jump.
  // He also stops running in the frame he lands, or a slow check could let him run on into
  // the EXIT door just past the pit.
  const tookOff = page.evaluate(async () => {
    let airborne = false;
    for (let i = 0; i < 1800; i++) {
      const p = window.__contro?.level()?.player;
      if (p && !airborne && p.x >= 824) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        airborne = true;
      } else if (p && airborne && p.onFloor && p.vy === 0 && p.x > 844) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight' }));
        return true;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return false;
  });
  await page.keyboard.down('ArrowRight');
  // The in-page script saw him take off and land past the pit edge.
  expect(await tookOff).toBe(true);
  const feet = await landed(page);
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })),
  );
  await page.keyboard.up('ArrowRight');
  const p = await player(page);
  expect(feet).toBe(FLOOR);
  expect(p.dead).toBe(false);
  expect(p.x).toBeGreaterThan(884);
});
