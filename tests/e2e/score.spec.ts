import { expect, test, type Page } from '@playwright/test';
import { level, nextSection, sceneKey, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const score = async (page: Page) => (await level(page)).score;
const addScore = (page: Page, n: number) => page.evaluate((v) => window.__contro?.addScore(v), n);
const saved = (page: Page) => page.evaluate(() => window.localStorage.getItem('contro.save.v1'));

test('destroying an alien scores its points, and the best score is saved', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  expect(await score(page)).toEqual({ score: 0, best: 0 });
  // Shoot the first walker (3 hits) from within range.
  await page.evaluate(() => window.__contro?.teleportPlayer(300));
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('KeyX');
    const s = await level(page);
    await waitGameTime(page, s.timeMs, 150);
  }
  await expect.poll(async () => (await score(page)).score, { timeout: 10_000 }).toBe(100);
  expect((await score(page)).best).toBe(100);
  expect(JSON.parse((await saved(page)) ?? '{}')).toEqual({ version: 1, bestScore: 100 });
  expect(watched.errors).toEqual([]);
});

test('the best score survives a reload, and a new run starts at zero', async ({ page }) => {
  await openLevel(page);
  await addScore(page, 1500);
  await page.reload();
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  expect(await score(page)).toEqual({ score: 0, best: 1500 });
});

test('score and lives carry into the next room', async ({ page }) => {
  await openLevel(page);
  await addScore(page, 700);
  await page.evaluate(() => window.__contro?.hurtPlayer(99));
  await expect.poll(async () => (await level(page)).player.lives, { timeout: 10_000 }).toBe(2);
  await nextSection(page);
  const room2 = await level(page);
  expect(room2.level).toBe('corridor-test-2');
  expect(room2.score.score).toBe(700);
  expect(room2.player).toMatchObject({ lives: 2, hp: 4 });
});

test('an extra life at 20 000 points, and another at 50 000', async ({ page }) => {
  await openLevel(page);
  await addScore(page, 19_900);
  expect((await level(page)).player.lives).toBe(3);
  await addScore(page, 100);
  await expect.poll(async () => (await level(page)).player.lives).toBe(4);
  await addScore(page, 30_000);
  await expect.poll(async () => (await level(page)).player.lives).toBe(5);
  await addScore(page, 100_000);
  expect((await level(page)).player.lives).toBe(5); // no more thresholds
});

test('game over resets the score but keeps the best', async ({ page }) => {
  await openLevel(page);
  await addScore(page, 900);
  for (let death = 0; death < 3; death++) {
    await page.evaluate(() => window.__contro?.hurtPlayer(99));
    if (death < 2) {
      await expect
        .poll(async () => (await level(page)).player.dead, { timeout: 10_000 })
        .toBe(false);
      const s = await level(page);
      await waitGameTime(page, s.timeMs, 1600); // past the invulnerability
    }
  }
  await expect.poll(async () => (await level(page)).gameOver, { timeout: 10_000 }).toBe(true);
  await expect
    .poll(async () => (await page.evaluate(() => window.__contro?.level() ?? null))?.gameOver, {
      timeout: 15_000,
    })
    .toBe(false);
  expect(await score(page)).toEqual({ score: 0, best: 900 });
  expect((await level(page)).player.lives).toBe(3);
});

test('Restart room restores the score the room was entered with', async ({ page }) => {
  await openLevel(page);
  await addScore(page, 500);
  await nextSection(page);
  await addScore(page, 300);
  expect((await score(page)).score).toBe(800);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await score(page)).score).toBe(500);
  expect((await level(page)).level).toBe('corridor-test-2');
  expect((await score(page)).best).toBe(800);
});

test('a corrupt save is ignored and the game still starts', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('contro.save.v1', '{oops'));
  const watched = watchPage(page);
  await openLevel(page);
  expect(await score(page)).toEqual({ score: 0, best: 0 });
  expect(watched.errors).toEqual([]);
});
