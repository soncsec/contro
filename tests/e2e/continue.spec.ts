import { expect, test, type Page } from '@playwright/test';
import { CONTINUE } from '../../src/config/tuning';
import { continueMenu, level, sceneKey, title, watchPage } from './watch';

/**
 * Continues after game over (M3.4). The run starts in a training section with a chosen number
 * of continues left (test hook), and loses its lives at once.
 */
test.describe.configure({ timeout: 120_000 });

async function openWith(page: Page, continues: number): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate((n) => window.__contro?.startLevel('corridor-test-2', n), continues);
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
}

/** Loses all three lives (each death waits for the respawn), then waits for the next screen. */
async function loseAllLives(page: Page): Promise<void> {
  for (let life = 3; life >= 1; life--) {
    await page.evaluate(() => window.__contro?.hurtPlayer(99));
    if (life > 1) {
      await expect
        .poll(async () => (await level(page)).player.lives, { timeout: 30_000 })
        .toBe(life - 1);
      await expect
        .poll(async () => (await level(page)).player.invulnerable, { timeout: 30_000 })
        .toBe(false);
    }
  }
  await expect.poll(() => sceneKey(page), { timeout: 120_000 }).toBe('Continue');
  await expect.poll(async () => (await continueMenu(page))?.ready, { timeout: 15_000 }).toBe(true);
}

test('a fresh run has the approved number of continues', async ({ page }) => {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  expect((await level(page)).continues).toBe(CONTINUE.count);
});

test('QUIT on the continue screen goes back to the title', async ({ page }) => {
  const watched = watchPage(page);
  await openWith(page, 2);
  await loseAllLives(page);
  expect(await continueMenu(page)).toMatchObject({ option: 'CONTINUE', left: 2 });
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await continueMenu(page))?.option).toBe('QUIT');
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Title');
  expect(watched.errors).toEqual([]);
});

test('the last continue restarts the section with none left after it', async ({ page }) => {
  await openWith(page, 1);
  await loseAllLives(page);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  const after = await level(page);
  expect(after).toMatchObject({ level: 'corridor-test-2', continues: 0, gameOver: false });
  expect(after.player.lives).toBe(3);
});

test('with no continues left, game over offers none and returns to the title', async ({ page }) => {
  const watched = watchPage(page);
  await openWith(page, 0);
  await loseAllLives(page);
  expect(await continueMenu(page)).toMatchObject({ option: null, left: 0 });
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Title');
  expect(watched.errors).toEqual([]);
});
