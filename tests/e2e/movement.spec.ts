import { expect, test, type Page } from '@playwright/test';
import { level, startGame, waitGameTime, watchPage } from './watch';

const RUN_SPEED = 90; // px/s, MOVEMENT.runSpeed in src/config/tuning.ts

/**
 * Allowed gap between distance moved and RUN_SPEED × game time. Physics steps on its own
 * fixed 1/60 s clock, so each of the two snapshots can be a step or two (1.5 px each) out.
 */
const tolerance = (expected: number): number => Math.max(6, expected * 0.1);

async function player(page: Page) {
  return (await level(page)).player;
}

/** Holds `key` for `ms` of game time; returns how far the player moved and the state at the end. */
async function runFor(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await expect.poll(async () => (await player(page)).anim).toBe('run');
  const from = await level(page);
  const to = await waitGameTime(page, from.timeMs, ms);
  await page.keyboard.up(key);
  return {
    moved: to.player.x - from.player.x,
    expected: (RUN_SPEED * (to.timeMs - from.timeMs)) / 1000,
    player: to.player,
  };
}

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await player(page)).onFloor).toBe(true);
}

test('arrow keys run right and left, and the marine turns to face the way he runs', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  expect(await player(page)).toMatchObject({ facing: 'right', anim: 'idle', vx: 0 });

  const right = await runFor(page, 'ArrowRight', 500);
  expect(right.player).toMatchObject({ facing: 'right', vx: 90, onFloor: true, feetY: 160 });
  // 90 px per second of game time, within a couple of physics steps.
  expect(Math.abs(right.moved - right.expected)).toBeLessThanOrEqual(tolerance(right.expected));
  await expect.poll(async () => (await player(page)).anim).toBe('idle');
  expect((await player(page)).vx).toBe(0);

  const left = await runFor(page, 'ArrowLeft', 300);
  expect(left.player).toMatchObject({ facing: 'left', vx: -90 });
  expect(Math.abs(-left.moved - left.expected)).toBeLessThanOrEqual(tolerance(left.expected));
  expect(watched.errors).toEqual([]);
});

test('WASD moves the marine too', async ({ page }) => {
  await openLevel(page);
  const right = await runFor(page, 'KeyD', 400);
  expect(right.player.facing).toBe('right');
  expect(Math.abs(right.moved - right.expected)).toBeLessThanOrEqual(tolerance(right.expected));
  const left = await runFor(page, 'KeyA', 200);
  expect(left.player.facing).toBe('left');
  expect(left.moved).toBeLessThan(0);
});

test('holding jump gives a full jump about one marine tall, then he lands', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await player(page)).anim).toBe('jump');
  // On the take-off frame the body still reports the floor, so wait until he has left it
  // before waiting for the landing (otherwise jump can be let go at once: a 5 px hop).
  await expect.poll(async () => (await player(page)).onFloor).toBe(false);
  // The game records the jump's highest point itself: sampling from outside for a fixed
  // real time can end before the apex when a busy machine slows the game down.
  await expect.poll(async () => (await player(page)).onFloor, { timeout: 15_000 }).toBe(true);
  await page.keyboard.up('Space');
  const top = (await player(page)).jumpPeakFeetY ?? 160;
  // Apex = 300² / (2 × 900) = 50 px above the floor at y=160.
  expect(160 - top).toBeGreaterThanOrEqual(44);
  expect(160 - top).toBeLessThanOrEqual(52);
  expect(await player(page)).toMatchObject({ feetY: 160, anim: 'idle' });
});

test('tapping jump gives a clearly lower hop than holding it', async ({ page }) => {
  await openLevel(page);
  // Heights are the game's own record of each jump's highest point (jumpPeakFeetY), so a
  // slowed-down game can't cut the measurement short.
  await page.keyboard.down('Space');
  await expect.poll(async () => (await player(page)).onFloor).toBe(false);
  await expect.poll(async () => (await player(page)).onFloor, { timeout: 15_000 }).toBe(true);
  await page.keyboard.up('Space');
  const full = 160 - ((await player(page)).jumpPeakFeetY ?? 160);

  // Let go in the very frame the jump starts, from inside the page. Waiting outside it (even
  // polling fast) can take several frames on a busy machine, which is a held jump, not a tap.
  const releaseOnTakeOff = page.evaluate(async () => {
    for (let i = 0; i < 600; i++) {
      if ((window.__contro?.level()?.player.vy ?? 0) < 0) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
        return true;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return false;
  });
  await page.keyboard.down('Space');
  expect(await releaseOnTakeOff).toBe(true);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await player(page)).onFloor).toBe(false);
  await expect.poll(async () => (await player(page)).onFloor, { timeout: 15_000 }).toBe(true);
  const hop = 160 - ((await player(page)).jumpPeakFeetY ?? 160);

  expect(hop).toBeGreaterThan(5);
  expect(hop).toBeLessThan(full - 10);
});

test('the marine cannot run off the left edge of the level', async ({ page }) => {
  await openLevel(page);
  const from = await level(page);
  await page.keyboard.down('ArrowLeft');
  // The start is 38 px from the wall: 0.42 s at 90 px/s. Hold for twice that in game time.
  const p = (await waitGameTime(page, from.timeMs, 850)).player;
  await page.keyboard.up('ArrowLeft');
  expect(p.x).toBe(8); // half the 16 px body: pressed against the wall
  expect(p.feetY).toBe(160);
});
