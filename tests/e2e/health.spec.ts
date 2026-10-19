import { expect, test, type Page } from '@playwright/test';
import {
  continueAfterGameOver,
  level,
  nextSection,
  startGame,
  waitGameTime,
  watchPage,
} from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

const hurt = (page: Page, damage: number) =>
  page.evaluate((d) => window.__contro?.hurtPlayer(d), damage);

/** Kills the player and waits for the respawn (or game over). */
async function dieAndWait(page: Page): Promise<void> {
  await hurt(page, 99);
  await expect.poll(async () => (await level(page)).player.dead).toBe(true);
  const dead = await level(page);
  // Respawn delay 1.2 s, then 1.5 s of invulnerability before the next hit can land.
  await waitGameTime(page, dead.timeMs, 1200 + 1600);
}

test('the marine starts with a full health bar and 3 lives', async ({ page }) => {
  await openLevel(page);
  expect((await level(page)).player).toMatchObject({
    hp: 4,
    lives: 3,
    dead: false,
    invulnerable: false,
  });
});

test('touching an alien hurts once, knocks the marine back, then he is briefly invulnerable', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  // Stand in the first walker's path (it patrols 372–468, walking left first).
  await page.evaluate(() => window.__contro?.teleportPlayer(380));
  await expect.poll(async () => (await level(page)).player.hp, { timeout: 10_000 }).toBe(3);
  const hit = await level(page);
  expect(hit.player.invulnerable).toBe(true);
  // Knocked away from the alien, which is to his right: 120 px/s for the 250 ms stun.
  const later = await waitGameTime(page, hit.timeMs, 300);
  expect(later.player.x).toBeLessThan(380 - 15);
  // Only one hit lands while invulnerable, even if the alien walks into him again.
  const end = await waitGameTime(page, hit.timeMs, 1300);
  expect(end.player.hp).toBe(3);
  expect(watched.errors).toEqual([]);
});

test('dying plays the death, then respawns at the start with a life fewer', async ({ page }) => {
  await openLevel(page);
  const startX = (await level(page)).player.x;
  await hurt(page, 99);
  await expect.poll(async () => (await level(page)).player.dead).toBe(true);
  expect((await level(page)).player.anim).toBe('die');
  await expect.poll(async () => (await level(page)).player.dead, { timeout: 10_000 }).toBe(false);
  const back = await level(page);
  expect(back.player).toMatchObject({ hp: 4, lives: 2, invulnerable: true });
  expect(back.player.x).toBe(startX);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  expect((await level(page)).player.feetY).toBe(160);
});

test('after passing the checkpoint he respawns there', async ({ page }) => {
  await openLevel(page);
  const start = await level(page);
  expect(start.respawnAt.x).toBe(48);
  // The reported x is the body centre, a fixed distance from the spawn point.
  const offset = start.respawnAt.x - start.player.x;
  await page.evaluate(() => window.__contro?.teleportPlayer(600)); // past the checkpoint at 560
  await expect.poll(async () => (await level(page)).respawnAt.x).toBe(560);
  await dieAndWait(page);
  const back = await level(page);
  expect(back.player.dead).toBe(false);
  expect(back.player.x).toBe(560 - offset);
  expect(back.player.lives).toBe(2);
});

test('losing the last life shows game over; CONTINUE restarts with full lives (M3.4)', async ({
  page,
}) => {
  // Three deaths plus the game-over screen take seconds of game time, which runs slowly on a
  // loaded machine (see boss.spec.ts).
  test.setTimeout(120_000);
  const watched = watchPage(page);
  await openLevel(page);
  await dieAndWait(page);
  await dieAndWait(page);
  expect((await level(page)).player.lives).toBe(1);
  await hurt(page, 99);
  await expect.poll(async () => (await level(page)).gameOver, { timeout: 10_000 }).toBe(true);
  // After "GAME OVER" comes the continue screen; continuing restarts with one fewer left.
  await continueAfterGameOver(page);
  const after = await level(page);
  expect(after.player).toMatchObject({ hp: 4, lives: 3, dead: false });
  expect(after.gameOver).toBe(false);
  expect(after.continues).toBe(2);
  expect(watched.errors).toEqual([]);
});

/** Hurts the marine by 1 and waits out the invulnerability. */
async function loseHealth(page: Page): Promise<void> {
  await hurt(page, 1);
  const s = await level(page);
  await waitGameTime(page, s.timeMs, 1600);
}

test('health carries into the next room (M2.13)', async ({ page }) => {
  await openLevel(page);
  await loseHealth(page);
  await loseHealth(page);
  expect((await level(page)).player.hp).toBe(2);
  await nextSection(page);
  const room2 = await level(page);
  expect(room2.level).toBe('corridor-test-2');
  expect(room2.player).toMatchObject({ hp: 2, lives: 3 });
});

test('Restart room puts health back to what the room was entered with', async ({ page }) => {
  await openLevel(page);
  await loseHealth(page);
  await nextSection(page);
  expect((await level(page)).player.hp).toBe(3);
  await loseHealth(page);
  await loseHealth(page);
  expect((await level(page)).player.hp).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__contro?.pauseMenu() ?? null)).toBe('RESUME');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).player.hp).toBe(3);
});

test('losing a life after carrying low health still respawns at full health', async ({ page }) => {
  await openLevel(page);
  await loseHealth(page);
  await loseHealth(page);
  await loseHealth(page);
  await nextSection(page);
  expect((await level(page)).player.hp).toBe(1);
  await hurt(page, 1);
  await expect.poll(async () => (await level(page)).player.dead).toBe(true);
  await expect.poll(async () => (await level(page)).player.dead, { timeout: 10_000 }).toBe(false);
  expect((await level(page)).player).toMatchObject({ hp: 4, lives: 2 });
});

test('game over in a later section restarts that section, not the level (M3.0)', async ({
  page,
}) => {
  // Three deaths plus the game-over screen take seconds of game time, which runs slowly on a
  // loaded machine (see boss.spec.ts).
  test.setTimeout(120_000);
  await openLevel(page);
  await nextSection(page);
  expect((await level(page)).level).toBe('corridor-test-2');
  await dieAndWait(page);
  await dieAndWait(page);
  await hurt(page, 99);
  await expect.poll(async () => (await level(page)).gameOver, { timeout: 10_000 }).toBe(true);
  await continueAfterGameOver(page);
  const after = await level(page);
  expect(after.level).toBe('corridor-test-2');
  expect(after.label).toBe('1-2');
  expect(after.player).toMatchObject({ lives: 3, dead: false });
});
