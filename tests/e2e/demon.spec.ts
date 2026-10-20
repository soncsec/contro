import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, title, waitGameTime, watchPage } from './watch';

/**
 * The demon, Level 3's boss (M5.3), in the hive's heart at the end of 3-6 (4-6 in the e2e
 * build, where training comes first). The test hook moves the marine into the arena and hurts
 * the demon.
 */
test.describe.configure({ timeout: 120_000 });

const FLOOR = 132; // the tissue crest's top at 128, feet 4 px into it

async function openChamber(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('hive-5'));
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
  // The fight starts once the marine passes the middle of the chamber (the map's last screen).
  const s = await level(page);
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), s.widthPx - 140);
  await expect.poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 }).toBe('fight');
}

test('the demon hovers above the floor and spits fans of acid at the marine', async ({ page }) => {
  const watched = watchPage(page);
  await openChamber(page);
  const s = await level(page);
  expect(s.label).toBe('4-6');
  expect(s.boss).toMatchObject({ type: 'demon', phase: 0, arenaLocked: true });
  // Its feet are well above the floor (36 px, bobbing 4): shoot it diagonally up.
  expect(s.boss?.feetY ?? FLOOR).toBeLessThan(FLOOR - 30);
  const later = await waitGameTime(page, s.timeMs, 2500);
  // A fan of three from its skull.
  expect(later.enemyShots.fired - s.enemyShots.fired).toBeGreaterThanOrEqual(3);
  expect(watched.errors).toEqual([]);
});

test('it breathes a wave of acid that rolls along the floor', async ({ page }) => {
  await openChamber(page);
  const s = await level(page);
  // The first wave comes 3.5 s in, on top of the fans of three.
  const later = await waitGameTime(page, s.timeMs, 5000);
  const fired = later.enemyShots.fired - s.enemyShots.fired;
  expect(fired % 3).not.toBe(0); // fans come in threes: a wave makes one more
});

test('below half health it swoops down across the chamber', async ({ page }) => {
  await openChamber(page);
  await page.evaluate(() => window.__contro?.hurtBoss(110));
  await expect.poll(async () => (await level(page)).boss?.phase).toBe(1);
  // Watch its feet: a swoop dips them down near the floor, then it rises again.
  const s = await level(page);
  let lowest = s.boss?.feetY ?? 0;
  for (let i = 0; i < 16; i++) {
    const now = await waitGameTime(page, s.timeMs + i * 250, 250);
    lowest = Math.max(lowest, now.boss?.feetY ?? 0);
  }
  expect(lowest).toBeGreaterThan(FLOOR - 20);
});

test('destroyed, it ends the game with the ending card, then the end screen', async ({ page }) => {
  await openChamber(page);
  const before = (await level(page)).score.score;
  await page.evaluate(() => window.__contro?.hurtBoss(1000));
  await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe('Dialogue');
  expect(await page.evaluate(() => window.__contro?.dialogue())).toMatchObject({
    card: 'level-3-end',
    more: [],
    nextLevel: null,
  });
  await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('End');
  const end = await page.evaluate(() => window.__contro?.end());
  expect(end?.score).toBeGreaterThanOrEqual(before + 15000);
});
