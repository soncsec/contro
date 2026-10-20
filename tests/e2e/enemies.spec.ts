import { expect, test, type Page } from '@playwright/test';
import { level, startGame, title, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
}

test('the map places two alien walkers that stand on the floor and patrol', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  const start = await level(page);
  const walkers = start.enemies.filter((e) => e.type === 'alien-walker');
  expect(walkers).toHaveLength(2);
  for (const e of walkers) expect(e).toMatchObject({ hp: 3, alive: true, feetY: 160 });

  // Watch the first walker (spawned at x=420) every frame until the level has run 6 s of game
  // time: walking 48 px each way at 30 px/s with 0.4 s pauses is one full cycle in 4 s.
  const seen = await page.evaluate(async () => {
    const xs: number[] = [];
    const facings = new Set<string>();
    const feet = new Set<number>();
    for (;;) {
      const snap = window.__contro?.level();
      const e = snap?.enemies[0];
      if (snap && e) {
        xs.push(e.x);
        facings.add(e.facing);
        feet.add(e.feetY);
        if (snap.timeMs >= 6000) break;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { min: Math.min(...xs), max: Math.max(...xs), facings: [...facings], feet: [...feet] };
  });
  expect(Math.abs(seen.min - (420 - 48))).toBeLessThanOrEqual(2);
  expect(Math.abs(seen.max - (420 + 48))).toBeLessThanOrEqual(2);
  expect(seen.facings.sort()).toEqual(['left', 'right']);
  expect(seen.feet).toEqual([160]);
  expect(watched.errors).toEqual([]);
});

test('an alien walker takes three hits, flashing each time, then dies', async ({ page }) => {
  await openLevel(page);
  // Stand within range of the first walker (spawned at x=420).
  await page.evaluate(() => window.__contro?.teleportPlayer(300));
  await expect.poll(async () => (await level(page)).cameraX).toBe(140);

  const hp: number[] = [];
  for (let shot = 1; shot <= 3; shot++) {
    await page.keyboard.press('KeyX');
    await expect
      .poll(async () => (await level(page)).enemies[0]?.hp, { timeout: 5000 })
      .toBe(3 - shot);
    hp.push((await level(page)).enemies[0]?.hp ?? -1);
    const fired = await level(page);
    await waitGameTime(page, fired.timeMs, 120); // past the tap limit before the next shot
  }
  expect(hp).toEqual([2, 1, 0]);
  const after = await level(page);
  expect(after.enemies[0]?.alive).toBe(false);
  expect(after.enemies[1]?.alive).toBe(true);
  expect(after.bullets).toMatchObject({ fired: 3 });
});

test('bullets pass through a dead alien', async ({ page }) => {
  await openLevel(page);
  await page.evaluate(() => window.__contro?.teleportPlayer(300));
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('KeyX');
    const s = await level(page);
    await waitGameTime(page, s.timeMs, 150);
  }
  await expect.poll(async () => (await level(page)).enemies[0]?.alive).toBe(false);
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await level(page)).bullets.fired).toBe(4);
  // The fourth bullet flies on (the second alien patrols far to the right of the view).
  const s = await level(page);
  const later = await waitGameTime(page, s.timeMs, 1500);
  expect(later.bullets.active).toBe(0);
  expect(later.enemies[1]?.hp).toBe(3);
});

// Walkers the map puts up on a walkway stay up there; they used to drop through it to the
// floor below (or down a pit), because only the marine collided with walkways.
interface MapObject {
  type: string;
  x: number;
  y: number;
  width: number;
  properties?: { name: string; value: unknown }[];
}

/** Indexes (in spawn order) and deck tops of the alien walkers a map stands on a walkway. */
async function walkersOnWalkways(
  page: Page,
  key: string,
): Promise<{ index: number; deckY: number }[]> {
  // The map as the game loads it, from our own origin.
  const response = await page.request.get(`assets/levels/${key}.tmj`);
  expect(response.ok()).toBe(true);
  const map = (await response.json()) as { layers: { name: string; objects?: MapObject[] }[] };
  const objects = (name: string) => map.layers.find((l) => l.name === name)?.objects ?? [];
  const decks = objects('collision').filter((o) => o.type === 'platform');
  const enemies = objects('spawns').filter((o) => o.type === 'enemy');
  const kind = (o: MapObject) => o.properties?.find((p) => p.name === 'enemy')?.value;
  return enemies.flatMap((o, index) => {
    const deck = decks.find((d) => d.y === o.y && o.x >= d.x && o.x <= d.x + d.width);
    return kind(o) === 'alien-walker' && deck ? [{ index, deckY: deck.y }] : [];
  });
}

for (const key of ['steelworks-1', 'hive-1']) {
  test(`walkers placed on walkways in ${key} stay on them`, async ({ page }) => {
    await page.goto('./');
    const onDecks = await walkersOnWalkways(page, key);
    expect(onDecks.length).toBeGreaterThan(0);
    await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
    await page.evaluate((k) => window.__contro?.startLevel(k), key);
    await expect
      .poll(async () => (await level(page)).player.onFloor, { timeout: 15_000 })
      .toBe(true);
    // Half a second in: long enough to have fallen, too short to have patrolled off an end.
    const start = await level(page);
    const later = await waitGameTime(page, start.timeMs, 500);
    for (const { index, deckY } of onDecks) {
      expect(later.enemies[index]?.alive).toBe(true);
      expect(later.enemies[index]?.feetY).toBe(deckY);
    }
  });
}
