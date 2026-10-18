import { expect, test, type Page } from '@playwright/test';
import { level, startGame, watchPage } from './watch';

const FLOOR = 160;
const HIGH = 87; // room 1's high catwalk deck, x 336–416

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const player = async (page: Page) => (await level(page)).player;

async function landed(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const p = await player(page);
        return p.onFloor && p.vy === 0;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

/**
 * Jump, and press jump again near the top of the first jump. Jump stays held afterwards:
 * letting go early cuts a jump short (short hops), so callers release it when they're done.
 */
async function doubleJump(page: Page): Promise<void> {
  // Re-press inside the page, in the right frame: wait until he's clearly rising (so the
  // first jump has really started), then until he has slowed to 120 px/s, about 40 px up,
  // leaving plenty of time before he could land even if frames are slow. Polling from outside the
  // page can see the speed of 0 *before* take-off and re-press too early on a busy machine.
  const repressed = page.evaluate(async () => {
    let rising = false;
    for (let i = 0; i < 600; i++) {
      const vy = window.__contro?.level()?.player.vy ?? 0;
      if (vy < -180) rising = true;
      if (rising && vy > -120) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        return true;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return false;
  });
  const before = (await level(page)).airJumps;
  await page.keyboard.down('Space');
  expect(await repressed).toBe(true);
  // Count double jumps (only ever goes up) rather than watch airJumpsLeft, which is restored
  // on landing and can be back to 1 before a slow check runs.
  await expect.poll(async () => (await level(page)).airJumps).toBe(before + 1);
}

test('a second press in mid-air jumps again, higher than a single jump can reach', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  await doubleJump(page);
  await landed(page);
  await page.keyboard.up('Space');
  // The game records the jump's peak itself, so slow frames can't hide the top.
  const top = FLOOR - ((await player(page)).jumpPeakFeetY ?? FLOOR);
  // A single jump peaks at 50 px; the double jump adds up to 35 px more.
  expect(top).toBeGreaterThan(60);
  expect(top).toBeLessThanOrEqual(87);
  expect((await level(page)).airJumps).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('only one double jump before landing, and it comes back on landing', async ({ page }) => {
  await openLevel(page);
  await doubleJump(page);
  await page.keyboard.up('Space');
  await page.keyboard.press('Space'); // a third press does nothing
  await landed(page);
  expect((await level(page)).airJumps).toBe(1);
  expect((await player(page)).airJumpsLeft).toBe(1);
});

test('a double jump reaches the high catwalk straight from the floor', async ({ page }) => {
  await openLevel(page);
  await page.evaluate(() => window.__contro?.teleportPlayer(376));
  await landed(page);
  await doubleJump(page);
  await landed(page);
  await page.keyboard.up('Space');
  expect(await player(page)).toMatchObject({ feetY: HIGH, onPlatform: true });
});

test('walking off a ledge still leaves the double jump', async ({ page }) => {
  await openLevel(page);
  // Get onto the low catwalk (x 176–304), then walk off its right end.
  await page.evaluate(() => window.__contro?.teleportPlayer(290));
  await landed(page);
  await page.keyboard.down('Space'); // a full jump: held until he lands on the catwalk
  await expect.poll(async () => (await player(page)).onFloor).toBe(false);
  await landed(page);
  await page.keyboard.up('Space');
  expect((await player(page)).feetY).toBe(119);
  // Press jump inside the page once he's falling at over 110 px/s: about 120 ms after leaving
  // the ledge (past the 90 ms coyote window) and well before he lands (about 300 ms). Timing
  // this from outside the page overshoots or undershoots on a busy machine.
  const pressedInAir = page.evaluate(async () => {
    for (let i = 0; i < 900; i++) {
      const p = window.__contro?.level()?.player;
      if (p && !p.onFloor && p.vy > 110) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        return true;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return false;
  });
  await page.keyboard.down('ArrowRight');
  expect(await pressedInAir).toBe(true);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await level(page)).airJumps).toBe(1);
});
