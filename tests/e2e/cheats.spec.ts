import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, startGame, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const pauseMenu = (page: Page) => page.evaluate(() => window.__contro?.pauseMenu() ?? null);
const message = (page: Page) => page.evaluate(() => window.__contro?.cheatMessage() ?? null);

async function pause(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => pauseMenu(page)).toBe('RESUME');
}

async function resume(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => pauseMenu(page)).toBeNull();
}

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyX',
  'Space',
];

/** Presses keys one by one, letting a frame pass between them so each is a separate press. */
async function enter(page: Page, keys: readonly string[]): Promise<void> {
  for (const k of keys) {
    await page.keyboard.press(k);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
  }
}

test('the Konami code on the pause screen gives five extra lives and stays paused', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  await pause(page);
  await enter(page, KONAMI);
  await expect.poll(() => message(page)).toBe('+5 LIVES');
  // Fire and jump were part of the code, so the menu didn't choose anything.
  expect(await pauseMenu(page)).not.toBeNull();
  await resume(page);
  const s = await level(page);
  expect(s.player.lives).toBe(8);
  expect(s.cheats).toEqual({ invincible: false, invisible: false, used: true });
  expect(watched.errors).toEqual([]);
});

test('IRON makes hits harmless, and typing it again turns it off', async ({ page }) => {
  await openLevel(page);
  await pause(page);
  await enter(page, ['KeyI', 'KeyR', 'KeyO', 'KeyN']);
  await expect.poll(() => message(page)).toBe('INVINCIBLE ON');
  await resume(page);
  await page.evaluate(() => window.__contro?.hurtPlayer(99));
  expect((await level(page)).player).toMatchObject({ hp: 4, dead: false });

  await pause(page);
  await enter(page, ['KeyI', 'KeyR', 'KeyO', 'KeyN']);
  await expect.poll(() => message(page)).toBe('INVINCIBLE OFF');
  await resume(page);
  await page.evaluate(() => window.__contro?.hurtPlayer(1));
  expect((await level(page)).player.hp).toBe(3);
});

test('GUNNY steps through every weapon, and counts as a cheat (M4.1)', async ({ page }) => {
  await openLevel(page);
  await pause(page);
  const GUNNY = ['KeyG', 'KeyU', 'KeyN', 'KeyN', 'KeyY'];
  for (const [weapon, shown] of [
    ['machine-gun', 'MACHINE GUN'],
    ['spread', 'SPREAD'],
    ['rifle', 'RIFLE'],
  ] as const) {
    await enter(page, GUNNY);
    await expect.poll(() => message(page)).toBe(shown);
    expect((await level(page)).player.weapon).toBe(weapon);
  }
  expect((await level(page)).cheats.used).toBe(true);
  await resume(page);
});

test('invincibility does not save him from a pit', async ({ page }) => {
  await openLevel(page);
  await pause(page);
  await enter(page, ['KeyI', 'KeyR', 'KeyO', 'KeyN']);
  await resume(page);
  await page.evaluate(() => window.__contro?.teleportPlayer(830));
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await level(page)).player.dead, { timeout: 10_000 }).toBe(true);
  await page.keyboard.up('ArrowRight');
});

test('GHOUL hides him: the flyer never shoots or dives', async ({ page }) => {
  await openLevel(page);
  await pause(page);
  await enter(page, ['KeyG', 'KeyH', 'KeyO', 'KeyU', 'KeyL']);
  await expect.poll(() => message(page)).toBe('INVISIBLE ON');
  await resume(page);
  // Right under room 1's flyer, well within its firing and diving range.
  const f = (await level(page)).enemies.find((e) => e.type === 'alien-flyer');
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), f?.x ?? 680);
  const start = await level(page);
  const later = await waitGameTime(page, start.timeMs, 4000);
  expect(later.enemyShots.fired).toBe(0);
  expect(later.enemies.find((e) => e.type === 'alien-flyer')?.mode).toBe('hover');
});

test('THRU skips straight to the next section, and cheats carry over', async ({ page }) => {
  await openLevel(page);
  await pause(page);
  await enter(page, ['KeyI', 'KeyR', 'KeyO', 'KeyN']);
  await enter(page, ['KeyT', 'KeyH', 'KeyR', 'KeyU']);
  // Room 2 is the next section of the same level, so no card comes between.
  await expect
    .poll(() => page.evaluate(() => window.__contro?.level()?.level ?? null))
    .toBe('corridor-test-2');
  expect(await sceneKey(page)).toBe('Level');
  const room2 = await level(page);
  expect(room2.level).toBe('corridor-test-2');
  expect(room2.cheats).toMatchObject({ invincible: true, used: true });
});

test('a cheated run never sets a best score', async ({ page }) => {
  await openLevel(page);
  await page.evaluate(() => window.__contro?.addScore(300));
  expect((await level(page)).score).toEqual({ score: 300, best: 300 });
  await pause(page);
  await enter(page, ['KeyI', 'KeyR', 'KeyO', 'KeyN']);
  await resume(page);
  await page.evaluate(() => window.__contro?.addScore(5000));
  expect((await level(page)).score).toEqual({ score: 5300, best: 300 });
  const saved = await page.evaluate(() => window.localStorage.getItem('contro.save.v1'));
  expect(JSON.parse(saved ?? '{}')).toEqual({
    version: 1,
    bestScore: 300,
    furthestLevel: 1,
  });
});

test('an ordinary menu choice still works after stray arrow presses', async ({ page }) => {
  await openLevel(page);
  await pause(page);
  await enter(page, ['ArrowDown', 'ArrowUp']);
  await page.keyboard.press('KeyX'); // chooses RESUME: no code was under way
  await expect.poll(() => pauseMenu(page)).toBeNull();
  expect((await level(page)).cheats.used).toBe(false);
});
