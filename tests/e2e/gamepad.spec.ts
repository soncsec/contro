import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, watchPage } from './watch';

// Standard gamepad button indexes (W3C): A = 0, B = 1, X = 2, Start = 9, d-pad 12–15.
const A = 0;
const X = 2;
const START = 9;
const RIGHT = 15;

/**
 * Installs a fake standard-mapping gamepad before the game loads. Phaser reads
 * navigator.getGamepads() every frame, so it sees this exactly like a real pad.
 */
async function installFakePad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    const pad = {
      id: 'Test pad (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: 'standard',
      get timestamp() {
        return performance.now();
      },
      get buttons() {
        return state.buttons;
      },
      get axes() {
        return state.axes;
      },
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null] });
    (window as unknown as { __pad: typeof state }).__pad = state;
  });
}

function button(page: Page, index: number, down: boolean): Promise<void> {
  return page.evaluate(
    ([i, on]) => {
      const pad = (
        window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } }
      ).__pad;
      const b = pad.buttons[i as number];
      if (b) {
        b.pressed = on as boolean;
        b.value = on ? 1 : 0;
      }
    },
    [index, down],
  );
}

function stick(page: Page, x: number, y: number): Promise<void> {
  return page.evaluate(
    ([ax, ay]) => {
      const pad = (window as unknown as { __pad: { axes: number[] } }).__pad;
      pad.axes[0] = ax as number;
      pad.axes[1] = ay as number;
    },
    [x, y],
  );
}

/**
 * Gamepads are polled once per frame, so a release shorter than a frame can't be seen
 * (no real thumb is that quick). Let a few frames pass.
 */
function frames(page: Page, n = 3): Promise<void> {
  return page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);
}

async function openLevel(page: Page): Promise<void> {
  await installFakePad(page);
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

test('the d-pad runs, A jumps and X fires', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);

  await button(page, RIGHT, true);
  await expect.poll(async () => (await level(page)).player.vx).toBe(90);
  await button(page, RIGHT, false);
  await expect.poll(async () => (await level(page)).player.vx).toBe(0);

  await button(page, A, true);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(false);
  await button(page, A, false);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);

  await button(page, X, true);
  await expect.poll(async () => (await level(page)).bullets.fired).toBeGreaterThan(0);
  await button(page, X, false);
  expect(watched.errors).toEqual([]);
});

test('the left stick moves and aims', async ({ page }) => {
  await openLevel(page);
  await stick(page, -0.9, 0);
  await expect.poll(async () => (await level(page)).player.facing).toBe('left');
  expect((await level(page)).player.vx).toBe(-90);
  await stick(page, 0, -0.9);
  await expect.poll(async () => (await level(page)).player.aim).toBe('diagonal');
  await stick(page, 0, 0.9);
  await expect.poll(async () => (await level(page)).player.crouching).toBe(true);
  // A small tilt inside the dead zone does nothing.
  await stick(page, 0.3, 0);
  await expect.poll(async () => (await level(page)).player.crouching).toBe(false);
  expect((await level(page)).player.vx).toBe(0);
});

test('Start pauses and resumes', async ({ page }) => {
  await openLevel(page);
  await button(page, START, true);
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  // Still holding Start doesn't close the menu.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  await button(page, START, false);
  await frames(page);
  await button(page, START, true);
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();
  await button(page, START, false);
  expect(await sceneKey(page)).toBe('Level');
});
