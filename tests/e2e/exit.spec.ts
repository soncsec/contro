import { expect, test, type Page } from '@playwright/test';
import { level, nextSection, sceneKey, startGame, walkThroughExit, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

function dialogue(page: Page) {
  return page.evaluate(() => window.__contro?.dialogue() ?? null);
}

test('a section exit leads straight to the next section, with no card', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  // Right is held the whole time, but the marine stops while the section fades out.
  const exit = await walkThroughExit(page);
  expect(exit).toEqual({ lastVx: 0, scene: 'Level' });

  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const room2 = await level(page);
  expect(room2.level).toBe('corridor-test-2');
  expect(room2.label).toBe('1-2');
  expect(room2.enemies.filter((e) => e.type === 'alien-walker')).toHaveLength(3);
  expect(room2.enemies.filter((e) => e.type === 'alien-flyer')).toHaveLength(2);
  expect(room2.exiting).toBe(false);
  expect(room2.player.x).toBeLessThan(80); // back at the start
  expect(watched.errors).toEqual([]);
});

test("the level's last section ends with a card, then the next level", async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  expect(await nextSection(page)).toBeNull();

  const exit = await walkThroughExit(page);
  expect(exit).toEqual({ lastVx: 0, scene: 'Dialogue' });
  expect(await dialogue(page)).toMatchObject({ card: 'level-1-end', nextLevel: 'corridor-test' });

  // A press during the first moments is ignored, so a held key can't skip the card.
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  expect(await sceneKey(page)).toBe('Dialogue');

  await expect.poll(async () => (await dialogue(page))?.ready).toBe(true);
  await page.keyboard.press('KeyX');
  await expect.poll(() => sceneKey(page)).toBe('Level');
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);

  // With one level so far, the campaign starts again: room 1, fresh enemies at full health.
  const back = await level(page);
  expect(back.level).toBe('corridor-test');
  expect(back.label).toBe('1-1');
  const full = { 'alien-walker': 3, 'alien-flyer': 2 } as const;
  expect(back.enemies.every((e) => e.alive && e.hp === full[e.type])).toBe(true);
  // Shooting still works after the restart.
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(1);
  expect(watched.errors).toEqual([]);
});
