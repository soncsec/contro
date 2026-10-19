import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, startGame, title, watchPage } from './watch';

/** Sound effects and music (M3.6). */
test.describe.configure({ timeout: 120_000 });

const sound = (page: Page) => page.evaluate(() => window.__contro?.sound() ?? null);

async function openSection(page: Page, key: string): Promise<void> {
  await startGame(page); // START is a key press, which unlocks audio in the browser
  await page.evaluate((k) => window.__contro?.startLevel(k), key);
  await expect.poll(async () => (await level(page)).level, { timeout: 15_000 }).toBe(key);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

test('Level 1 plays its music, and firing makes a sound', async ({ page, browserName }) => {
  const watched = watchPage(page);
  await openSection(page, 'steelworks-1');
  await expect.poll(async () => (await sound(page))?.music).toBe('music-level-1');
  expect((await sound(page))?.loaded).toEqual(
    expect.arrayContaining(['music-level-1', 'sfx-shot']),
  );
  // Headless Firefox on the CI and dev machines has no audio device, so its audio never
  // unlocks there; Chromium checks the music really plays. (Desktop Firefox: checked by hand.)
  if (browserName === 'chromium') {
    await expect
      .poll(async () => (await sound(page))?.playing, { timeout: 15_000 })
      .toBe('music-level-1');
  }
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await sound(page))?.recent).toContain('sfx-shot');
  expect(watched.errors).toEqual([]);
});

test('the tank fight switches to the boss music, which stops when the tank is destroyed', async ({
  page,
}) => {
  await openSection(page, 'steelworks-5');
  expect((await sound(page))?.music).toBe('music-level-1');
  const exitX = (await level(page)).exitX;
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), exitX);
  await expect.poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 }).toBe('fight');
  await expect.poll(async () => (await sound(page))?.music).toBe('music-boss');
  await page.evaluate(() => window.__contro?.hurtBoss(1000));
  await expect.poll(async () => (await sound(page))?.music, { timeout: 30_000 }).toBeNull();
  expect((await sound(page))?.recent).toContain('sfx-boss-blast');
});

test('SOUND on the pause menu turns sound off, and it stays off after a reload', async ({
  page,
}) => {
  await startGame(page);
  expect((await sound(page))?.on).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('SOUND');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await sound(page))?.on).toBe(false);

  await page.reload();
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  expect((await sound(page))?.on).toBe(false);
  expect(await sceneKey(page)).toBe('Title');
});
