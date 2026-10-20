import { expect, test, type Page } from '@playwright/test';
import { BOSSES } from '../../src/data/bosses';
import { level, sceneKey, title, waitGameTime, watchPage } from './watch';

/**
 * The mech, Level 2's boss (M4.4), at the end of 2-5 (3-5 in the e2e build, where training
 * comes first). The test hook moves the marine into the arena and hurts the mech.
 */
test.describe.configure({ timeout: 120_000 });

async function openArena(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('neon-5'));
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
  // The fight starts once the marine passes the middle of the arena (the map's last screen).
  const s = await level(page);
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), s.widthPx - 140);
  await expect.poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 }).toBe('fight');
}

test('the mech walks in, then fires its spread at the marine', async ({ page }) => {
  const watched = watchPage(page);
  await openArena(page);
  const s = await level(page);
  expect(s.boss).toMatchObject({
    type: 'mech',
    hp: BOSSES.mech.tuning.hp,
    phase: 0,
    arenaLocked: true,
  });
  const later = await waitGameTime(page, s.timeMs, 2500);
  // Three shots at a time from its chest light.
  expect(later.enemyShots.fired - s.enemyShots.fired).toBeGreaterThanOrEqual(3);
  expect(watched.errors).toEqual([]);
});

test('below half health it changes phase and leaps', async ({ page }) => {
  await openArena(page);
  await page.evaluate(() => window.__contro?.hurtBoss(80));
  await expect.poll(async () => (await level(page)).boss?.phase).toBe(1);
  // Its leap carries it towards the marine: watch its x move faster than it walks.
  const s = await level(page);
  const xs: number[] = [];
  for (let i = 0; i < 12; i++) {
    const now = await waitGameTime(page, s.timeMs + i * 300, 300);
    xs.push(now.boss?.x ?? 0);
  }
  const fastest = Math.max(...xs.slice(1).map((x, i) => Math.abs(x - (xs[i] ?? x))));
  // Walking moves at most 36 px/s (11 px in 300 ms); a 1 s leap covers far more.
  expect(fastest).toBeGreaterThan(20);
});

test('destroyed, it ends Level 2 with its card, then Level 3 with the score carried on', async ({
  page,
}) => {
  await openArena(page);
  const before = (await level(page)).score.score;
  await page.evaluate(() => window.__contro?.hurtBoss(1000));
  await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe('Dialogue');
  expect(await page.evaluate(() => window.__contro?.dialogue())).toMatchObject({
    card: 'level-2-end',
    more: ['level-3-intro'],
    nextLevel: 'hive-1',
  });
  for (const card of ['level-2-end', 'level-3-intro']) {
    await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.card)).toBe(card);
    await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
    await page.keyboard.press('KeyX');
  }
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  const next = await level(page);
  expect(next.level).toBe('hive-1');
  expect(next.score.score).toBeGreaterThanOrEqual(before + 8000);
});
