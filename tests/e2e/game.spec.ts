import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, startGame, walkThroughExit, watchPage } from './watch';

/**
 * M6.3: the whole game in one run, from START on the title screen to the end screen, with no
 * console errors or third-party requests, in Chrome and Firefox. Each map section is left by
 * its exit with IRON on, the base core's rooms are skipped with THRU, and each boss is
 * destroyed with the test hook after its frame rate is measured. Every section is visited.
 */
test.describe.configure({ timeout: 900_000 });

async function pauseAndType(page: Page, keys: string[]): Promise<boolean> {
  await page.keyboard.press('Escape');
  const paused = await page
    .waitForFunction(() => window.__contro?.pauseMenu() === 'RESUME', null, { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (paused) for (const k of keys) await page.keyboard.press(k);
  return paused;
}

/** Presses through dialogue cards until a level, a base stage or the end screen runs. */
async function throughCards(page: Page, seen: string[]): Promise<void> {
  for (let i = 0; i < 20 && (await sceneKey(page)) === 'Dialogue'; i++) {
    const d = await page.evaluate(() => window.__contro?.dialogue() ?? null);
    if (d && seen[seen.length - 1] !== d.card) seen.push(d.card);
    await expect
      .poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready ?? null))
      .toBe(true);
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(400);
  }
}

test('the whole game, from START to the end screen, in one run', async ({ page }, testInfo) => {
  const watched = watchPage(page);
  await startGame(page);
  expect(await pauseAndType(page, ['KeyI', 'KeyR', 'KeyO', 'KeyN']), 'the pause menu opens').toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();

  const sections: string[] = [];
  const cards: string[] = [];
  const fps: string[] = [];
  for (let step = 0; step < 40; step++) {
    const scene = await sceneKey(page);
    if (scene === 'End') break;
    if (scene === 'Dialogue') {
      await throughCards(page, cards);
      continue;
    }
    if (scene === 'Base') {
      const b = await page.evaluate(() => window.__contro?.base() ?? null);
      if (b && sections[sections.length - 1] !== b.section) sections.push(b.section);
      if (await pauseAndType(page, ['KeyT', 'KeyH', 'KeyR', 'KeyU']))
        await page.waitForTimeout(2500);
      else await page.waitForTimeout(500);
      continue;
    }
    if (scene !== 'Level') {
      await page.waitForTimeout(500);
      continue;
    }
    await expect
      .poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 })
      .toBe(true);
    const s = await level(page);
    sections.push(s.level);
    if (s.boss) {
      // The boss: start the fight, measure the frame rate while it runs, then destroy it.
      // Past the middle of the arena (the map's last screen), where every fight starts.
      await page.evaluate((x) => window.__contro?.teleportPlayer(x), s.widthPx - 140);
      await expect
        .poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 })
        .toBe('fight');
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(300);
        samples.push(await page.evaluate(() => window.__contro?.fps() ?? 0));
      }
      fps.push(`${s.boss.type} ${Math.min(...samples)}–${Math.max(...samples)}`);
      expect(Math.max(...samples)).toBeGreaterThan(0);
      await page.evaluate(() => window.__contro?.hurtBoss(1000));
      await expect.poll(() => sceneKey(page), { timeout: 60_000 }).not.toBe('Level');
      continue;
    }
    const exit = await walkThroughExit(page);
    if (exit.scene === 'Level') {
      await expect
        .poll(async () => (await page.evaluate(() => window.__contro?.level()?.level)) ?? s.level)
        .not.toBe(s.level);
    }
  }
  testInfo.annotations.push({ type: 'boss fight fps', description: fps.join('; ') });

  expect(await sceneKey(page)).toBe('End');
  // Every section of the campaign was played, in order (training first in the e2e build).
  expect(sections).toEqual([
    'corridor-test',
    'corridor-test-2',
    'steelworks-1',
    'steelworks-2',
    'steelworks-3',
    'steelworks-4',
    'steelworks-5',
    'neon-1',
    'neon-2',
    'neon-3',
    'neon-4',
    'neon-5',
    'hive-1',
    'hive-2',
    'hive-core',
    'hive-3',
    'hive-4',
    'hive-5',
  ]);
  expect(cards).toEqual([
    'training-end',
    'level-1-intro',
    'level-1-end',
    'level-2-intro',
    'level-2-end',
    'level-3-intro',
    'level-3-end',
  ]);
  expect(fps).toHaveLength(3); // the tank, the mech and the demon
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});
