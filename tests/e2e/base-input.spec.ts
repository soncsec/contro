import { expect, test, type Page } from '@playwright/test';
import { sceneKey, title } from './watch';

/**
 * The into-the-screen base stage with a gamepad and on a phone (M5.6d): the base scene reads
 * the same input as the levels, so the d-pad, buttons and touch controls all work in it.
 */
test.describe.configure({ timeout: 120_000 });

const A = 0;
const X = 2;
const RIGHT = 15;

const base = async (page: Page) => {
  const s = await page.evaluate(() => window.__contro?.base() ?? null);
  if (!s) throw new Error('no base stage is running');
  return s;
};

async function openBase(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('hive-core'));
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Base');
}

/** A fake standard gamepad, installed before the game loads (as in gamepad.spec.ts). */
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

/** Puts a thumb down on a touch control (offset from its centre); returns how to lift it. */
async function thumb(page: Page, selector: string, dx = 0, dy = 0): Promise<() => Promise<void>> {
  const id = await page.evaluate(
    ({ selector, dx, dy }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`no ${selector}`);
      const box = el.getBoundingClientRect();
      const pointerId = Math.floor(Math.random() * 1e6) + 2;
      const init = {
        pointerId,
        pointerType: 'touch',
        isPrimary: false,
        bubbles: true,
        clientX: box.left + box.width / 2 + dx,
        clientY: box.top + box.height / 2 + dy,
      };
      el.dispatchEvent(new PointerEvent('pointerdown', init));
      el.dispatchEvent(new PointerEvent('pointermove', init));
      return pointerId;
    },
    { selector, dx, dy },
  );
  return async () => {
    await page.evaluate(
      ({ selector, id }) => {
        document
          .querySelector(selector)
          ?.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, bubbles: true }));
      },
      { selector, id },
    );
  };
}

test('with a gamepad: the d-pad moves him, A jumps, X fires into the room', async ({ page }) => {
  await installFakePad(page);
  await openBase(page);
  const start = await base(page);
  await button(page, RIGHT, true);
  await expect.poll(async () => (await base(page)).marine.x).toBeGreaterThan(start.marine.x + 20);
  await button(page, RIGHT, false);
  await button(page, A, true);
  await expect.poll(async () => (await base(page)).marine.h).toBeGreaterThan(5);
  await button(page, A, false);
  await expect.poll(async () => (await base(page)).marine.h).toBe(0);
  const before = (await base(page)).shots.fired;
  await button(page, X, true);
  await expect.poll(async () => (await base(page)).shots.fired).toBeGreaterThan(before);
  await button(page, X, false);
});

test.describe('on a phone', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'mobile emulation is Chromium only');
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('the touch controls show, the stick moves him and FIRE keeps firing', async ({ page }) => {
    await openBase(page);
    for (const c of ['.touch-stick', '.touch-fire', '.touch-jump', '.touch-pause']) {
      await expect(page.locator(c)).toBeVisible();
    }
    const start = await base(page);
    const lift = await thumb(page, '.touch-stick', 60, 0);
    await expect.poll(async () => (await base(page)).marine.x).toBeGreaterThan(start.marine.x + 20);
    await lift();
    // Touch FIRE auto-fires while held (owner decision 2026-10-18), here as in the levels.
    const before = (await base(page)).shots.fired;
    const release = await thumb(page, '.touch-fire');
    await expect
      .poll(async () => (await base(page)).shots.fired, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(before + 3);
    await release();
  });
});
