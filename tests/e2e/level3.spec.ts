import { expect, test } from '@playwright/test';
import { level, nextSectionCards, sceneKey, title, watchPage } from './watch';

/**
 * M5.6d: Level 3 in one run, from its first section to the end screen: the alien base, the
 * into-the-screen base core (all four rooms), the hive and the demon. Each map section is left
 * by its exit (the test hook moves the marine to it) with the IRON cheat on; the base core's
 * rooms are skipped with THRU; the demon is destroyed with the test hook. Score, lives and
 * cheats carry all the way, through the base scene too. Level 3 is level 4 in the e2e build.
 */
test.describe.configure({ timeout: 300_000 });

test('Level 3 plays from 3-1 through the base core and the hive to the demon and the end', async ({
  page,
}, testInfo) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('hive-1'));
  await expect.poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.addScore(1000));
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  for (const k of ['KeyI', 'KeyR', 'KeyO', 'KeyN']) await page.keyboard.press(k);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.cheatMessage() ?? null))
    .toBe('INVINCIBLE ON');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();

  // 3-1 to 3-2, then 3-2's exit into the base core.
  expect((await level(page)).label).toBe('4-1');
  expect(await nextSectionCards(page)).toEqual([]);
  const two = await level(page);
  expect(two.label).toBe('4-2');
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), two.exitX - 20);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => sceneKey(page), { timeout: 30_000 }).toBe('Base');
  await page.keyboard.up('ArrowRight');
  const core = await page.evaluate(() => window.__contro?.base() ?? null);
  expect(core?.label).toBe('4-3');
  expect(core?.cheats.invincible).toBe(true); // the cheat carried into the base scene
  expect(core?.score.score).toBeGreaterThanOrEqual(1000);

  // The base core's four rooms: THRU skips each; a press during a room's fade is retried.
  for (let i = 0; i < 30 && (await sceneKey(page)) === 'Base'; i++) {
    await page.keyboard.press('Escape');
    const paused = await page
      .waitForFunction(() => window.__contro?.pauseMenu() === 'RESUME', null, { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (paused) for (const k of ['KeyT', 'KeyH', 'KeyR', 'KeyU']) await page.keyboard.press(k);
    await page.waitForTimeout(paused ? 2500 : 500);
  }
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).level).toBe('hive-3');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const hive = await level(page);
  expect(hive.label).toBe('4-4');
  expect(hive.cheats.invincible).toBe(true); // and back out of it
  expect(hive.score.score).toBeGreaterThan(core?.score.score ?? 0); // the cores' points

  // 3-4 to 3-5 to 3-6.
  expect(await nextSectionCards(page)).toEqual([]);
  expect((await level(page)).label).toBe('4-5');
  expect(await nextSectionCards(page)).toEqual([]);
  const last = await level(page);
  expect(last.label).toBe('4-6');
  expect(last.player.lives).toBe(3); // invincible all the way

  // The demon: the fight starts in the chamber; measure the frame rate while it runs.
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), last.exitX);
  await expect.poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 }).toBe('fight');
  const fps: number[] = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    fps.push(await page.evaluate(() => window.__contro?.fps() ?? 0));
  }
  testInfo.annotations.push({
    type: 'demon fight fps',
    description: `${Math.min(...fps)}–${Math.max(...fps)} (this machine's load: see the CI log)`,
  });
  expect(Math.max(...fps)).toBeGreaterThan(0);
  await page.evaluate(() => window.__contro?.hurtBoss(1000));

  // The ending card, then the end screen with the run's score.
  await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe('Dialogue');
  expect(await page.evaluate(() => window.__contro?.dialogue()?.card)).toBe('level-3-end');
  await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('End');
  const end = await page.evaluate(() => window.__contro?.end());
  expect(end?.score).toBeGreaterThanOrEqual(1000 + 15000); // added, plus the demon
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});
