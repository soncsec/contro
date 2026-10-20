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

test('shooting the core destroys it; the barrier drops and he walks on into room 2', async ({
  page,
}) => {
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
  await expect.poll(async () => (await base(page)).room, { timeout: 15_000 }).toBe(2);
  expect((await base(page)).cleared).toBe(false);
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

/** Skips rooms with THRU until the given room (1-based) is running. */
async function skipTo(page: Page, room: number): Promise<void> {
  while ((await base(page)).room < room) {
    const now = (await base(page)).room;
    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null))
      .toBe('RESUME');
    for (const k of ['KeyT', 'KeyH', 'KeyR', 'KeyU']) await page.keyboard.press(k);
    await expect.poll(async () => (await base(page)).room, { timeout: 15_000 }).toBe(now + 1);
  }
}

test('four rooms; the second has two wall turrets that fire out of the room at him', async ({
  page,
}) => {
  await openBase(page);
  expect((await base(page)).rooms).toBe(4);
  await cheat(page, 'IRON', 'INVINCIBLE ON');
  await skipTo(page, 2);
  const s = await base(page);
  expect(s.turrets).toBe(2);
  await expect
    .poll(async () => (await base(page)).incoming.fired, { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test('shooting a turret destroys it', async ({ page }) => {
  await openBase(page);
  await cheat(page, 'IRON', 'INVINCIBLE ON');
  await skipTo(page, 2);
  // The left turret sits at x 70: step left in short taps until he stands under it (holding
  // the key until a poll notices would carry him past it to the wall).
  for (let i = 0; i < 40 && (await base(page)).marine.x > 85; i++) {
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(80);
    await page.keyboard.up('ArrowLeft');
  }
  const x = (await base(page)).marine.x;
  expect(x).toBeGreaterThan(50);
  expect(x).toBeLessThanOrEqual(85);
  await expect
    .poll(
      async () => {
        const s = await base(page);
        if (s.turrets < 2) return 'down';
        await page.keyboard.press('KeyX');
        return s.turrets;
      },
      { timeout: 60_000, intervals: [150] },
    )
    .toBe('down');
});

test('the last room is the fourth, and its core fires back', async ({ page }) => {
  await openBase(page);
  await cheat(page, 'IRON', 'INVINCIBLE ON');
  await skipTo(page, 4);
  const s = await base(page);
  expect(s.room).toBe(4);
  // The core's fan of three plus two turrets: several shots within a few seconds.
  await expect
    .poll(async () => (await base(page)).incoming.fired, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(4);
});

test('after the fourth room the stage ends and the level goes on', async ({ page }) => {
  await openBase(page);
  await skipTo(page, 4);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  for (const k of ['KeyT', 'KeyH', 'KeyR', 'KeyU']) await page.keyboard.press(k);
  // The next section or, while the core is Level 3's last section, its card.
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toMatch(/^(Level|Dialogue)$/);
});
