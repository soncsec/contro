import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, title } from './watch';

/**
 * The ending and credits (M5.4): after the demon falls and the ending card, MISSION COMPLETE,
 * then the credits roll over the ending theme, then the title screen.
 */
test.describe.configure({ timeout: 120_000 });

const end = (page: Page) => page.evaluate(() => window.__contro?.end() ?? null);

async function reachEnding(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('hive-5'));
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
  const s = await level(page);
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), s.widthPx - 140);
  await expect.poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 }).toBe('fight');
  await page.evaluate(() => window.__contro?.hurtBoss(1000));
  await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe('Dialogue');
  await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('End');
}

test('MISSION COMPLETE, then the credits over the ending theme, then the title', async ({
  page,
}) => {
  await reachEnding(page);
  expect((await end(page))?.phase).toBe('ending');
  await expect.poll(() => page.evaluate(() => window.__contro?.sound().music)).toBe('music-ending');
  await expect.poll(async () => (await end(page))?.ready).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await end(page))?.phase).toBe('credits');
  await expect.poll(async () => (await end(page))?.ready).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Title');
});

test('left alone, the ending moves on to the credits by itself', async ({ page }) => {
  await reachEnding(page);
  expect((await end(page))?.phase).toBe('ending');
  await expect.poll(async () => (await end(page))?.phase, { timeout: 20_000 }).toBe('credits');
});
