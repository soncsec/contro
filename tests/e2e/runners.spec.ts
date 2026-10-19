import { expect, test, type Page } from '@playwright/test';
import { level, title, waitGameTime, watchPage } from './watch';

/**
 * Enemies that run in from the screen's edge (M3.14). Section 1-1 (2-1 in the e2e build) has
 * a spawner at column 40 (x 640) that sends three runners in from the right.
 */
test.describe.configure({ timeout: 120_000 });

async function openYard(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('steelworks-1'));
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
}

const runners = async (page: Page) =>
  (await level(page)).enemies.filter((e) => e.type === 'alien-runner');

test('no runners until the spawner scrolls into view', async ({ page }) => {
  await openYard(page);
  const s = await level(page);
  await waitGameTime(page, s.timeMs, 1500);
  expect(await runners(page)).toEqual([]);
});

test('runners come in from the right edge, run left, and die to one shot', async ({ page }) => {
  const watched = watchPage(page);
  await openYard(page);
  // Stand where the spawner (x 640) is on screen, facing right towards where they come from.
  await page.evaluate(() => window.__contro?.teleportPlayer(520));
  await expect
    .poll(async () => (await runners(page)).length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  const first = (await runners(page))[0];
  const view = await level(page);
  expect(first?.x).toBeGreaterThan(view.cameraX + 320); // it appears outside the view
  expect(first?.facing).toBe('left');
  const later = await waitGameTime(page, view.timeMs, 400);
  const moved = later.enemies.filter((e) => e.type === 'alien-runner')[0];
  expect(moved?.x).toBeLessThan(first?.x ?? 0); // running in, towards the marine

  // One hit kills it, for 50 points.
  await expect
    .poll(
      async () => {
        const s = await level(page);
        const r = s.enemies.find((e) => e.type === 'alien-runner' && e.alive);
        if (!r) return 'none';
        if (Math.abs(r.x - s.player.x) < 150) await page.keyboard.press('KeyX');
        return 'alive';
      },
      { timeout: 30_000, intervals: [50] },
    )
    .toBe('none');
  const after = await level(page);
  expect(after.score.score % 50).toBe(0);
  expect(after.score.score).toBeGreaterThanOrEqual(50);
  expect(watched.errors).toEqual([]);
});

test('a spawner sends its count and no more', async ({ page }) => {
  await openYard(page);
  await page.evaluate(() => window.__contro?.teleportPlayer(520));
  // Three runners, 1.2 s apart; IRON keeps the marine alive while they reach him.
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  for (const k of ['KeyI', 'KeyR', 'KeyO', 'KeyN']) await page.keyboard.press(k);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.cheatMessage() ?? null))
    .toBe('INVINCIBLE ON');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();
  await expect.poll(async () => (await level(page)).runnersSpawned, { timeout: 30_000 }).toBe(3);
  const s = await level(page);
  const later = await waitGameTime(page, s.timeMs, 3000);
  expect(later.runnersSpawned).toBe(3);
});
