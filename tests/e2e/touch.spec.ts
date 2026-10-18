import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, startGame, waitGameTime, watchPage } from './watch';

/**
 * Phone touch controls (M3.11). Chromium's phone emulation (touch screen, landscape iPhone
 * size); Firefox has no mobile emulation, so these run in Chromium only. The thumbs are
 * pointer events sent to the on-screen controls, as a real touch screen sends them.
 */

/** Puts a thumb down on a control (offset from its centre), and returns a function to lift it. */
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

const player = async (page: Page) => (await level(page)).player;

test.describe('on a phone', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'mobile emulation is Chromium only');
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  async function openLevel(page: Page): Promise<void> {
    await startGame(page);
    await expect.poll(async () => (await player(page)).onFloor).toBe(true);
  }

  test('the touch controls appear, with the approved layout', async ({ page }) => {
    const watched = watchPage(page);
    await openLevel(page);
    for (const c of ['.touch-stick', '.touch-fire', '.touch-jump', '.touch-pause']) {
      await expect(page.locator(c)).toBeVisible();
    }
    const box = async (c: string) => {
      const b = await page.locator(c).boundingBox();
      if (!b) throw new Error(`${c} has no box`);
      return b;
    };
    const stick = await box('.touch-stick');
    const fire = await box('.touch-fire');
    const jump = await box('.touch-jump');
    const pause = await box('.touch-pause');
    // Stick bottom-left; FIRE and JUMP bottom-right, JUMP the higher and further right;
    // pause top-left.
    expect(stick.x).toBeLessThan(844 / 4);
    expect(stick.y + stick.height).toBeGreaterThan(390 * 0.8);
    expect(fire.x).toBeGreaterThan(844 * 0.75);
    expect(jump.x).toBeGreaterThan(fire.x);
    expect(jump.y).toBeLessThan(fire.y);
    expect(pause.x).toBeLessThan(844 / 4);
    expect(pause.y).toBeLessThan(390 / 4);
    // On a phone this wide the picture is 640 px (2×), with the stick in the gutter beside it.
    const canvas = await box('canvas');
    expect(canvas.width).toBe(640);
    expect(stick.x + stick.width).toBeLessThanOrEqual(canvas.x + 40);
    expect(watched.errors).toEqual([]);
  });

  test('the stick runs him, and he stops when the thumb lifts', async ({ page }) => {
    await openLevel(page);
    const lift = await thumb(page, '.touch-stick', 50, 0);
    await expect.poll(async () => (await player(page)).vx).toBeGreaterThan(0);
    await lift();
    await expect.poll(async () => (await player(page)).vx).toBe(0);
    // The knob springs back to the centre.
    await expect(page.locator('.touch-knob')).toHaveCSS('transform', 'none');
  });

  test('up-right on the stick aims diagonally while running; down crouches', async ({ page }) => {
    await openLevel(page);
    let lift = await thumb(page, '.touch-stick', 35, -35);
    await expect
      .poll(async () => {
        const p = await player(page);
        return p.aim === 'diagonal' && p.vx > 0;
      })
      .toBe(true);
    await lift();
    lift = await thumb(page, '.touch-stick', 0, 50);
    await expect.poll(async () => (await player(page)).crouching).toBe(true);
    await lift();
    await expect.poll(async () => (await player(page)).crouching).toBe(false);
  });

  test('JUMP jumps and FIRE fires one shot per tap, while the stick is held', async ({ page }) => {
    await openLevel(page);
    const run = await thumb(page, '.touch-stick', 50, 0);
    const jump = await thumb(page, '.touch-jump');
    await expect.poll(async () => (await player(page)).onFloor).toBe(false);
    await jump();
    for (let i = 1; i <= 2; i++) {
      const fire = await thumb(page, '.touch-fire');
      await expect.poll(async () => (await level(page)).bullets.fired).toBe(i);
      await fire();
      const s = await level(page);
      await waitGameTime(page, s.timeMs, 150); // the one-shot rifle needs a fresh press
    }
    expect((await level(page)).bullets.fired).toBe(2);
    await run();
  });

  test('the pause button opens the pause menu, and again closes it', async ({ page }) => {
    await openLevel(page);
    let tap = await thumb(page, '.touch-pause');
    await tap();
    await expect.poll(() => sceneKey(page)).toBe('Pause');
    tap = await thumb(page, '.touch-pause');
    await tap();
    await expect.poll(() => sceneKey(page)).toBe('Level');
  });

  test('the title guide lists the touch controls', async ({ page }) => {
    await page.goto('./');
    await expect.poll(() => page.evaluate(() => window.__contro?.title()?.ready)).toBe(true);
    // Choose CONTROLS with the stick and FIRE.
    const down = await thumb(page, '.touch-stick', 0, 50);
    await expect.poll(() => page.evaluate(() => window.__contro?.title()?.option)).toBe('CONTROLS');
    await down();
    const fire = await thumb(page, '.touch-fire');
    await expect.poll(() => page.evaluate(() => window.__contro?.title()?.controls)).toBe(true);
    await fire();
    expect(await page.evaluate(() => window.__contro?.title()?.touch)).toBe(true);
  });

  test('turned upright, it asks to turn the phone sideways and the game waits', async ({
    page,
  }) => {
    await openLevel(page);
    await expect(page.locator('#rotate')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#rotate')).toBeVisible();
    await expect(page.locator('#rotate')).toHaveText(/TURN YOUR PHONE\s*SIDEWAYS TO PLAY/);
    await expect(page.locator('.touch-stick')).toBeHidden();
    const t = (await level(page)).timeMs;
    await page.waitForTimeout(500);
    expect((await level(page)).timeMs).toBe(t); // the game is paused
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#rotate')).toBeHidden();
    await waitGameTime(page, t, 200); // and runs again
  });
});

test('there are no touch controls on a computer', async ({ page }) => {
  await startGame(page);
  await expect(page.locator('.touch')).toHaveCount(0);
  await expect(page.locator('#rotate')).toBeHidden();
});
