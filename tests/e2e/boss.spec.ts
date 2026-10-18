import { expect, test, type Page } from '@playwright/test';
import { level, title, watchPage } from './watch';

/**
 * The Level 1 boss fight (M3.2–M3.3): the tank in the arena at the end of section 1-5.
 * Arena: x 2560–2880. It locks once the marine's centre reaches x 2720.
 */
const ARENA_X = 2560;
const LOCK_X = 2720;
const SAFE_X = 2600; // left side of the arena, out of the tank's reach

async function openFurnace(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => window.__contro?.startLevel('steelworks-5'));
  await expect
    .poll(() => page.evaluate(() => window.__contro?.level()?.level ?? null), { timeout: 15_000 })
    .toBe('steelworks-5');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const boss = async (page: Page) => {
  const b = (await level(page)).boss;
  if (!b) throw new Error('no boss in this section');
  return b;
};
const teleport = (page: Page, x: number) =>
  page.evaluate((v) => window.__contro?.teleportPlayer(v), x);

/** Steps into the arena (locking it), then back to its safe left side. */
async function startFight(page: Page): Promise<void> {
  await teleport(page, LOCK_X + 10);
  await expect.poll(async () => (await boss(page)).arenaLocked).toBe(true);
  await teleport(page, SAFE_X);
  await expect.poll(async () => (await boss(page)).mode, { timeout: 15_000 }).toBe('fight');
}

test('the tank waits until the marine reaches the middle of the arena', async ({ page }) => {
  const watched = watchPage(page);
  await openFurnace(page);
  const b = await boss(page);
  expect(b).toMatchObject({ type: 'tank', mode: 'waiting', arenaLocked: false });
  expect(b.hp).toBe(b.maxHp);
  await teleport(page, LOCK_X - 20);
  await page.waitForTimeout(300);
  expect((await boss(page)).arenaLocked).toBe(false);
  await teleport(page, LOCK_X + 10);
  await expect.poll(async () => (await boss(page)).arenaLocked).toBe(true);
  expect((await level(page)).cameraX).toBe(ARENA_X);
  // It rolls in from the right, then fights.
  await expect.poll(async () => (await boss(page)).mode, { timeout: 15_000 }).toBe('fight');
  expect(watched.errors).toEqual([]);
});

test('once the fight starts the arena is closed behind him', async ({ page }) => {
  await openFurnace(page);
  await startFight(page);
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await level(page)).player.vx).toBeLessThan(0);
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowLeft');
  const p = await level(page);
  expect(p.player.x).toBeGreaterThanOrEqual(ARENA_X);
  expect(p.cameraX).toBe(ARENA_X);
});

test('the exit stays shut while the tank is alive', async ({ page }) => {
  await openFurnace(page);
  const exitX = (await level(page)).exitX;
  await teleport(page, exitX + 32);
  await page.waitForTimeout(500);
  const s = await level(page);
  expect(s.exiting).toBe(false);
  expect(s.boss?.arenaLocked).toBe(true);
});

test('the cannon fires at head height: crouching ducks under it, standing is hit', async ({
  page,
}) => {
  await openFurnace(page);
  await startFight(page);
  const start = await level(page);
  // Crouched through two cannon shots, he is not hurt.
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await level(page)).enemyShots.fired, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(start.enemyShots.fired + 2);
  await expect.poll(async () => (await level(page)).enemyShots.active, { timeout: 15_000 }).toBe(0);
  expect((await level(page)).player.hp).toBe(start.player.hp);
  await page.keyboard.up('ArrowDown');
  // Standing, the next shot hits him.
  await expect
    .poll(async () => (await level(page)).player.hp, { timeout: 15_000 })
    .toBeLessThan(start.player.hp);
});

test('bullets hurt the tank; below half health it adds the mortar', async ({ page }) => {
  await openFurnace(page);
  await startFight(page);
  const { maxHp } = await boss(page);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await boss(page)).hp).toBe(maxHp - 1);
  expect((await boss(page)).phase).toBe(0);
  // Down to half health: phase 2.
  await page.evaluate((n) => window.__contro?.hurtBoss(n), maxHp / 2 - 1);
  await expect.poll(async () => (await boss(page)).phase).toBe(1);
});

test('destroyed, it blows up for 5000 points and the level ends with its card', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openFurnace(page);
  await startFight(page);
  const before = (await level(page)).score.score;
  const { maxHp } = await boss(page);
  await page.evaluate((n) => window.__contro?.hurtBoss(n), maxHp);
  await expect.poll(async () => (await boss(page)).mode).toBe('dying');
  expect((await level(page)).score.score).toBe(before + 5000);
  await expect
    .poll(() => page.evaluate(() => window.__contro?.dialogue()?.card ?? null), {
      timeout: 15_000,
    })
    .toBe('level-1-end');
  expect(watched.errors).toEqual([]);
});

test('dying in the fight starts it again: full health, arena open', async ({ page }) => {
  await openFurnace(page);
  await startFight(page);
  const { maxHp } = await boss(page);
  await page.evaluate(() => window.__contro?.hurtBoss(20));
  expect((await boss(page)).hp).toBe(maxHp - 20);
  await page.evaluate(() => window.__contro?.hurtPlayer(99));
  await expect.poll(async () => (await level(page)).player.dead).toBe(true);
  await expect.poll(async () => (await level(page)).player.dead, { timeout: 10_000 }).toBe(false);
  const s = await level(page);
  expect(s.boss).toMatchObject({ hp: maxHp, mode: 'waiting', arenaLocked: false });
  expect(s.player.x).toBeLessThan(ARENA_X); // back at the checkpoint before the arena
  await expect.poll(async () => (await level(page)).cameraX).toBeLessThan(ARENA_X);
});
