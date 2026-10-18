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
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Title');
  // Fire at once, before the screen takes input.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await title(page))?.ready).toBe(true);
  expect(await sceneKey(page)).toBe('Title');
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
