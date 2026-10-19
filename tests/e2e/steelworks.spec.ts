import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, title, walkThroughExit, watchPage } from './watch';

/** Opens the game and jumps straight to a section of the steelworks (M3.1). */
async function openSection(page: Page, key: string): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate((k) => window.__contro?.startLevel(k), key);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.level()?.level ?? null), { timeout: 15_000 })
    .toBe(key);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const SKYLINE = ['industrial-sky', 'industrial-far', 'industrial-mid', 'industrial-near'];

/**
 * Level 1's sections in play order. In the e2e build the training corridor is level 1, so the
 * steelworks is level 2 here. Indoor sections have no skyline: their wall is part of the map.
 */
const SECTIONS = [
  { key: 'steelworks-1', name: 'the yard', tiles: 180, walkers: 12, flyers: 4, outdoor: true },
  { key: 'steelworks-2', name: 'the interior', tiles: 170, walkers: 16, flyers: 5, outdoor: false },
  {
    key: 'steelworks-3',
    name: 'the rust factory',
    tiles: 160,
    walkers: 18,
    flyers: 5,
    outdoor: false,
  },
  { key: 'steelworks-4', name: 'the gantries', tiles: 170, walkers: 20, flyers: 6, outdoor: true },
  {
    key: 'steelworks-5',
    name: 'the furnace hall',
    tiles: 180,
    walkers: 24,
    flyers: 6,
    outdoor: false,
    boss: true,
  },
] as const;

SECTIONS.forEach((section, i) => {
  const label = `2-${i + 1}`;
  const next = SECTIONS[i + 1];

  test(`${label} ${section.name} loads, and the marine stands on the steel`, async ({ page }) => {
    const watched = watchPage(page);
    await openSection(page, section.key);
    const s = await level(page);
    expect(s.scenery).toEqual(section.outdoor ? SKYLINE : []);
    expect(s.label).toBe(label);
    expect(s.player.feetY).toBe(136);
    expect(s.widthPx).toBe(section.tiles * 16);
    expect(s.enemies.filter((e) => e.type === 'alien-walker')).toHaveLength(section.walkers);
    expect(s.enemies.filter((e) => e.type === 'alien-flyer')).toHaveLength(section.flyers);
    expect(watched.errors).toEqual([]);
    expect(watched.foreignRequests).toEqual([]);
  });

  if (next) {
    test(`${label} ${section.name} leads straight into ${next.name}, with no card`, async ({
      page,
    }) => {
      await openSection(page, section.key);
      const exit = await walkThroughExit(page);
      expect(exit.scene).toBe('Level');
      await expect.poll(async () => (await level(page)).level).toBe(next.key);
      expect((await level(page)).label).toBe(`2-${i + 2}`);
    });
  } else {
    test(`${label} ${section.name} ends the level with its card, after its boss`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await openSection(page, section.key);
      // The exit stays shut until the boss is destroyed (M3.2): start the fight and win it.
      // (The fight itself is tested in boss.spec.ts.)
      expect('boss' in section && section.boss).toBe(true);
      const exitX = (await level(page)).exitX;
      await page.evaluate((x) => window.__contro?.teleportPlayer(x), exitX);
      await expect
        .poll(async () => (await level(page)).boss?.mode, { timeout: 60_000 })
        .toBe('fight');
      await page.evaluate(() => window.__contro?.hurtBoss(1000));
      await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe('Dialogue');
      // The last level so far: after its card comes the end screen, then the title (M3.4).
      expect(await page.evaluate(() => window.__contro?.dialogue())).toMatchObject({
        card: 'level-1-end',
        more: [],
        nextLevel: null,
      });
      await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
      await page.keyboard.press('KeyX');
      await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('End');
      const end = await page.evaluate(() => window.__contro?.end());
      expect(end?.score).toBeGreaterThanOrEqual(5000); // the tank alone is worth 5000
      await expect.poll(() => page.evaluate(() => window.__contro?.end()?.ready)).toBe(true);
      await page.keyboard.press('KeyX');
      await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Title');
    });
  }
});
