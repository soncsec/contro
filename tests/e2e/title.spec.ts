import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, title, watchPage } from './watch';

async function openTitle(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
}

test('the game opens on the title screen, and START plays level 1-1', async ({ page }) => {
  const watched = watchPage(page);
  await openTitle(page);
  expect(await title(page)).toEqual({
    option: 'START',
    controls: false,
    ready: true,
    best: 'HI 000000',
    touch: false, // a computer: the guide lists keys, not the touch controls
    options: ['START', 'CONTROLS', 'MORE GAMES'], // no LEVEL row before level 2 is reached
    level: 1,
  });
  await page.keyboard.press('KeyX'); // fire selects too
  await expect.poll(() => sceneKey(page)).toBe('Level');
  const s = await level(page);
  expect(s.level).toBe('corridor-test');
  expect(s.label).toBe('1-1');
  expect(s.score.score).toBe(0);
  expect(s.player).toMatchObject({ lives: 3, hp: 4 });
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('a press in the first moments is ignored, so a held key cannot skip the title', async ({
  page,
}) => {
  await page.goto('./');
  // Press Space from inside the page on the first frame the title shows, while it says it
  // isn't ready: waiting from outside the page can take longer than the delay on a busy
  // machine, and then the press would rightly count.
  const pressedEarly = await page.evaluate(async () => {
    for (let i = 0; i < 1200; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const t = window.__contro?.title();
      if (!t) continue;
      if (t.ready) return false;
      const key = { code: 'Space', key: ' ' };
      window.dispatchEvent(new KeyboardEvent('keydown', key));
      window.dispatchEvent(new KeyboardEvent('keyup', key));
      return true;
    }
    return false;
  });
  expect(pressedEarly).toBe(true);
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  expect(await sceneKey(page)).toBe('Title');
  // The same in-page press does count once the title is ready (so the test can't pass by
  // the event simply not reaching the game).
  await page.evaluate(() => {
    const key = { code: 'Space', key: ' ' };
    window.dispatchEvent(new KeyboardEvent('keydown', key));
    window.dispatchEvent(new KeyboardEvent('keyup', key));
  });
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
});

test('up and down move through the menu, wrapping around', async ({ page }) => {
  await openTitle(page);
  const option = async () => (await title(page))?.option;
  await page.keyboard.press('ArrowDown');
  await expect.poll(option).toBe('CONTROLS');
  await page.keyboard.press('ArrowDown');
  await expect.poll(option).toBe('MORE GAMES');
  await page.keyboard.press('ArrowDown');
  await expect.poll(option).toBe('START');
  await page.keyboard.press('ArrowUp');
  await expect.poll(option).toBe('MORE GAMES');
});

test('CONTROLS opens the guide, and a press closes it', async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await title(page))?.controls).toBe(true);
  // Up/down do nothing while the guide is open.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await title(page))?.controls).toBe(false);
  expect((await title(page))?.option).toBe('CONTROLS');
  expect(await sceneKey(page)).toBe('Title');
});

test('MORE GAMES goes to the games portal, one folder up', async ({ page }) => {
  await openTitle(page);
  const start = page.url();
  await page.keyboard.press('ArrowUp'); // wraps to MORE GAMES
  await expect.poll(async () => (await title(page))?.option).toBe('MORE GAMES');
  const navigation = page.waitForRequest((r) => r.isNavigationRequest());
  await page.keyboard.press('Space');
  expect((await navigation).url()).toBe(new URL('../', start).href);
});

test('the title shows the saved best score', async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('contro.save.v1', JSON.stringify({ version: 1, bestScore: 4200 })),
  );
  await openTitle(page);
  expect((await title(page))?.best).toBe('HI 004200');
});
