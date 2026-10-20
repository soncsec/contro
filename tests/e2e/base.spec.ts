import { expect, test, type Page } from '@playwright/test';
import { sceneKey, title, watchPage } from './watch';

/**
 * The into-the-screen base stage (ADR-C11, M5.6a): Level 3's base core, one room so far. The
 * marine, seen from behind, moves along the near edge and shoots into the room; walkers run
 * out of the far end; destroying the core drops the barrier.
 */
test.describe.configure({ timeout: 120_000 });

const base = async (page: Page) => {
  const s = await page.evaluate(() => window.__contro?.base() ?? null);
  if (!s) throw new Error('no base stage is running');
  return s;
};

async function openBase(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('hive-core'));
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Base');
}

/** A cheat typed on the pause screen. */
async function cheat(page: Page, word: string, message: string): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  for (const k of word) await page.keyboard.press(`Key${k}`);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.cheatMessage() ?? null))
    .toBe(message);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBeNull();
}

test('it loads with the marine at the near edge and the core behind its barrier', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openBase(page);
  const s = await base(page);
  expect(s.label).toMatch(/^4-\d$/); // Level 3 is level 4 in the e2e build
  expect(s.room).toBe(1);
  expect(s.coreHp).toBeGreaterThan(0);
  expect(s.cleared).toBe(false);
  expect(s.marine).toMatchObject({ x: 160, h: 0, crouching: false, dead: false });
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('he runs along the near edge, jumps and crouches', async ({ page }) => {
  await openBase(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await base(page)).marine.x).toBeGreaterThan(200);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyZ');
  await expect.poll(async () => (await base(page)).marine.h).toBeGreaterThan(10);
  await expect.poll(async () => (await base(page)).marine.h).toBe(0);
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await base(page)).marine.crouching).toBe(true);
  await page.keyboard.up('ArrowDown');
});

test('walkers run out of the far end and hurt him if he stands in their way', async ({ page }) => {
  await openBase(page);
  await expect
    .poll(async () => (await base(page)).walkersSent, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const s = await base(page);
  expect(s.walkers.every((w) => w.z <= 1 && w.z >= 0)).toBe(true);
  await expect.poll(async () => (await base(page)).hp, { timeout: 30_000 }).toBeLessThan(s.hp);
});

test('shooting the core destroys it; the barrier drops and the stage ends', async ({ page }) => {
  await openBase(page);
  await cheat(page, 'IRON', 'INVINCIBLE ON');
  const start = await base(page);
  const before = start.score.score;
  await expect
    .poll(
      async () => {
        const s = await base(page);
        if (s.cleared) return 'cleared';
        await page.keyboard.press('KeyX');
        return s.coreHp;
      },
      { timeout: 90_000, intervals: [150] },
    )
    .toBe('cleared');
  expect((await base(page)).score.score).toBeGreaterThanOrEqual(before + 1000);
  // The last room: on to the next section or, while the core is Level 3's last, its card.
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).not.toBe('Base');
  expect(['Level', 'Dialogue']).toContain(await sceneKey(page));
});

test('the pause menu works here too, and THRU skips the room', async ({ page }) => {
  await openBase(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  // Typing THRU skips the room and goes straight back to the game.
  for (const k of ['KeyT', 'KeyH', 'KeyR', 'KeyU']) await page.keyboard.press(k);
  await expect
    .poll(async () => (await page.evaluate(() => window.__contro?.base()))?.cleared ?? true)
    .toBe(true);
});
