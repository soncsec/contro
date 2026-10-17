import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
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

test('losing the last life shows game over, then the level restarts with full lives', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openLevel(page);
  await dieAndWait(page);
  await dieAndWait(page);
  expect((await level(page)).player.lives).toBe(1);
  await hurt(page, 99);
  await expect.poll(async () => (await level(page)).gameOver, { timeout: 10_000 }).toBe(true);
  // After "GAME OVER" the level restarts.
  await expect
    .poll(async () => (await page.evaluate(() => window.__contro?.level() ?? null))?.gameOver, {
      timeout: 15_000,
    })
    .toBe(false);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  expect((await level(page)).player).toMatchObject({ hp: 4, lives: 3, dead: false });
  expect(watched.errors).toEqual([]);
});
