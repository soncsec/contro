import { expect, test, type Page } from '@playwright/test';
import { level, sceneKey, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

function dialogue(page: Page) {
  return page.evaluate(() => window.__contro?.dialogue() ?? null);
}

/**
 * Puts the player just before this room's exit and walks into it, holding right throughout.
 * Returns the player's speed on the room's last frame before the card appears.
 */
async function walkIntoExit(page: Page): Promise<number | null> {
  const { widthPx } = await level(page);
  // Both test rooms end with the EXIT door 9 tiles into the last 21-tile section.
  const exitX = widthPx - 12 * 16;
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), exitX - 20);
  await page.keyboard.down('ArrowRight');
  // Watch every frame from inside the page: the fade is short and polling could miss it.
  const lastVx = await page.evaluate(async () => {
    let vx: number | null = null;
    for (let i = 0; i < 600; i++) {
      const snap = window.__contro?.level();
      if (!snap) break; // the room has gone: the card is up
      vx = snap.player.vx;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return vx;
  });
  await page.keyboard.up('ArrowRight');
  return lastVx;
}

test('walking into the exit shows the card, then the next room', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  // Right is held the whole time, but the marine stops while the room fades out.
  expect(await walkIntoExit(page)).toBe(0);

  await expect.poll(() => sceneKey(page)).toBe('Dialogue');
  expect(await dialogue(page)).toMatchObject({ card: 'room-1-exit', nextLevel: 'corridor-test-2' });

  // A press during the first moments is ignored, so a held key can't skip the card.
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  expect(await sceneKey(page)).toBe('Dialogue');

  await expect.poll(async () => (await dialogue(page))?.ready).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page)).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const room2 = await level(page);
  expect(room2.level).toBe('corridor-test-2');
  expect(room2.enemies.filter((e) => e.type === 'alien-walker')).toHaveLength(3);
  expect(room2.enemies.filter((e) => e.type === 'alien-flyer')).toHaveLength(2);
  expect(room2.exiting).toBe(false);
  expect(room2.player.x).toBeLessThan(80); // back at the start
  expect(watched.errors).toEqual([]);
});

test('the second room leads back to the first, and the first still plays', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  for (const expected of [
    { card: 'room-1-exit', nextLevel: 'corridor-test-2' },
    { card: 'room-2-exit', nextLevel: 'corridor-test' },
  ]) {
    await walkIntoExit(page);
    await expect.poll(() => sceneKey(page)).toBe('Dialogue');
    expect(await dialogue(page)).toMatchObject(expected);
    await expect.poll(async () => (await dialogue(page))?.ready).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => sceneKey(page)).toBe('Level');
    await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  }
  // Back in room 1 with fresh enemies, and shooting still works after the restart.
  const back = await level(page);
  expect(back.level).toBe('corridor-test');
  // Fresh enemies: all alive at full health (walkers 3, flyers 2).
  const full = { 'alien-walker': 3, 'alien-flyer': 2 } as const;
  expect(back.enemies.every((e) => e.alive && e.hp === full[e.type])).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  expect(watched.errors).toEqual([]);
});
