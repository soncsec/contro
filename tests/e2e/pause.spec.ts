import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, startGame, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const pauseMenu = (page: Page) => page.evaluate(() => window.__contro?.pauseMenu() ?? null);

test('Escape pauses the game, and pressing it again resumes', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => pauseMenu(page)).toBe('RESUME');

  // Nothing moves while paused: the game clock stops.
  const frozen = await level(page);
  await page.waitForTimeout(400);
  expect((await level(page)).timeMs).toBe(frozen.timeMs);
  // Even holding right does nothing.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowRight');
  expect((await level(page)).player.x).toBe(frozen.player.x);

  await page.keyboard.press('Escape');
  await expect.poll(() => pauseMenu(page)).toBeNull();
  await waitGameTime(page, frozen.timeMs, 200); // the clock runs again
  // The resume press doesn't immediately pause again.
  expect(await sceneKey(page)).toBe('Level');
  expect(watched.errors).toEqual([]);
});

test('P also pauses, and Resume can be chosen from the menu', async ({ page }) => {
  await openLevel(page);
  await page.keyboard.press('KeyP');
  await expect.poll(() => pauseMenu(page)).toBe('RESUME');
  await page.keyboard.press('KeyX');
  await expect.poll(() => pauseMenu(page)).toBeNull();
  expect(await sceneKey(page)).toBe('Level');
});

test('Restart room from the pause menu restarts the room', async ({ page }) => {
  await openLevel(page);
  const start = await level(page);
  await page.evaluate(() => window.__contro?.teleportPlayer(600));
  await expect.poll(async () => (await level(page)).player.x).toBeGreaterThan(590);

  await page.keyboard.press('Escape');
  await expect.poll(() => pauseMenu(page)).toBe('RESUME');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => pauseMenu(page)).toBe('RESTART ROOM');
  for (const option of ['MUSIC', 'EFFECTS', 'FULLSCREEN']) {
    // M6.2: volume rows and fullscreen.
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => pauseMenu(page)).toBe(option);
  }
  await page.keyboard.press('ArrowDown'); // wraps around
  await expect.poll(() => pauseMenu(page)).toBe('RESUME');
  await page.keyboard.press('ArrowUp'); // and back the other way
  await expect.poll(() => pauseMenu(page)).toBe('FULLSCREEN');
  for (const option of ['EFFECTS', 'MUSIC', 'RESTART ROOM']) {
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => pauseMenu(page)).toBe(option);
  }
  await page.keyboard.press('Space');

  await expect.poll(() => pauseMenu(page)).toBeNull();
  await expect.poll(async () => (await level(page)).player.x).toBe(start.player.x);
  const restarted = await level(page);
  expect(restarted.level).toBe('corridor-test');
  expect(restarted.timeMs).toBeLessThan(2000);
  expect(restarted.player).toMatchObject({ hp: 4, lives: 3 });
});
