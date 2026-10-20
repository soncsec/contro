import { expect, test } from '@playwright/test';
import { level, nextSectionCards, sceneKey, startGame, watchPage } from './watch';

/**
 * M3.7: Level 1 from the title screen to the end screen in one run. Each section is left by
 * its exit (the test hook moves the marine to it) with the IRON cheat on, the tank is
 * destroyed with the test hook, and score, lives and cheats carry all the way. In the e2e build the training corridor is level 1,
 * so the steelworks is level 2 here.
 */
test.describe.configure({ timeout: 300_000 });

test('Level 1 plays from START through all five sections and the tank to the end screen', async ({
  page,
}, testInfo) => {
  const watched = watchPage(page);
  await startGame(page);
  expect((await level(page)).level).toBe('corridor-test');
  expect(await nextSectionCards(page)).toEqual([]);
  // The training level's end card, then the steelworks' intro card.
  expect(await nextSectionCards(page)).toEqual(['training-end', 'level-1-intro']);

  await page.evaluate(() => window.__contro?.addScore(1000));
  // IRON (invincibility; pits still kill): this test is about getting through the level and
  // the frame rate in the boss fight, not dodging. The fight itself is tested in boss.spec.ts.
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  for (const k of ['KeyI', 'KeyR', 'KeyO', 'KeyN']) await page.keyboard.press(k);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.cheatMessage() ?? null))
    .toBe('INVINCIBLE ON');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();
  for (let section = 1; section <= 4; section++) {
    const s = await level(page);
    expect(s.level).toBe(`steelworks-${section}`);
    expect(s.label).toBe(`2-${section}`);
    expect(await nextSectionCards(page)).toEqual([]);
  }
  const last = await level(page);
  expect(last.level).toBe('steelworks-5');
  expect(last.score.score).toBeGreaterThanOrEqual(1000); // the score carried through
  expect(last.player.lives).toBe(3); // invincible all the way
  expect(last.cheats.invincible).toBe(true); // the cheat carried through every section

  // The tank: the fight starts at the arena; measure the frame rate while it runs.
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), last.exitX);
  await expect.poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 }).toBe('fight');
  const fps: number[] = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    fps.push(await page.evaluate(() => window.__contro?.fps() ?? 0));
  }
  testInfo.annotations.push({
    type: 'boss fight fps',
    description: `${Math.min(...fps)}–${Math.max(...fps)} (this machine's load: see the CI log)`,
  });
  expect(Math.max(...fps)).toBeGreaterThan(0);
  await page.evaluate(() => window.__contro?.hurtBoss(1000));

  // Its card, then the Level 2 card (M3.7's goal), then Level 2 with the score carried on.
  await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe('Dialogue');
  for (const card of ['level-1-end', 'level-2-intro']) {
    await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.card)).toBe(card);
    await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
    await page.keyboard.press('KeyX');
  }
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  const next = await level(page);
  expect(next.level).toBe('neon-1');
  expect(next.score.score).toBeGreaterThanOrEqual(6000); // 1000 added + 5000 for the tank
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});
