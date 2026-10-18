import { expect, type Page } from '@playwright/test';
import type { LevelSnapshot } from '../../src/scenes/LevelScene';

/** Records console errors, uncaught exceptions and requests to other hosts. */
export function watchPage(page: Page): { errors: string[]; foreignRequests: string[] } {
  const errors: string[] = [];
  const foreignRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') {
      foreignRequests.push(req.url());
    }
  });
  return { errors, foreignRequests };
}

export async function sceneKey(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__contro?.scene() ?? null);
}

export async function level(page: Page): Promise<LevelSnapshot> {
  const snap = await page.evaluate(() => window.__contro?.level() ?? null);
  if (!snap) throw new Error('no level is running');
  return snap;
}

/**
 * Waits until the gameplay clock has advanced `ms` past `fromMs`, then returns the level state.
 * Use this instead of wall-clock waits: under load the game runs slower than real time.
 */
export async function waitGameTime(page: Page, fromMs: number, ms: number): Promise<LevelSnapshot> {
  // Under load the game can run at a fraction of real time (a fifth was seen with other
  // sessions' tests saturating the machine), so allow generously.
  await expect
    .poll(async () => (await level(page)).timeMs - fromMs, { timeout: Math.max(10_000, ms * 10) })
    .toBeGreaterThanOrEqual(ms);
  return level(page);
}

export interface ExitResult {
  /** The marine's speed on the section's last frame (right is held throughout). */
  lastVx: number | null;
  /** 'Dialogue' if a card followed the exit, 'Level' if the next section started directly. */
  scene: string | null;
}

/**
 * Puts the marine just before this section's exit and walks into it, holding right until
 * the section has gone. Runs inside the page, every frame, so a short fade can't be missed.
 */
export async function walkThroughExit(page: Page): Promise<ExitResult> {
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  const { widthPx, level: from } = await level(page);
  // Both test rooms end with the EXIT door 9 tiles into the last 21-tile stretch.
  const exitX = widthPx - 12 * 16;
  await page.evaluate((x) => window.__contro?.teleportPlayer(x), exitX - 20);
  return page.evaluate(async (fromLevel) => {
    const right = { code: 'ArrowRight', key: 'ArrowRight' };
    window.dispatchEvent(new KeyboardEvent('keydown', right));
    let lastVx: number | null = null;
    let scene: string | null = null;
    for (let i = 0; i < 3000; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      scene = window.__contro?.scene() ?? null;
      const snap = window.__contro?.level();
      if (scene === 'Dialogue' || (snap && snap.level !== fromLevel)) break;
      if (snap) lastVx = snap.player.vx;
    }
    window.dispatchEvent(new KeyboardEvent('keyup', right));
    return { lastVx, scene };
  }, from);
}

/**
 * Leaves this section by its exit, passing the level-end card if there is one, and waits
 * until the next section is running with the marine on the floor. Returns the card shown.
 */
export async function nextSection(page: Page): Promise<string | null> {
  const from = (await level(page)).level;
  const { scene } = await walkThroughExit(page);
  let card: string | null = null;
  if (scene === 'Dialogue') {
    card = (await page.evaluate(() => window.__contro?.dialogue()?.card)) ?? null;
    await expect.poll(() => page.evaluate(() => window.__contro?.dialogue()?.ready)).toBe(true);
    await page.keyboard.press('KeyX');
  }
  await expect
    .poll(() => page.evaluate(() => window.__contro?.level()?.level ?? null))
    .not.toBe(from);
  await expect.poll(async () => (await level(page)).player.onFloor).toBe(true);
  return card;
}

/** The title screen's state, or null if it isn't showing. */
export function title(page: Page) {
  return page.evaluate(() => window.__contro?.title() ?? null);
}

/** Opens the game and chooses START on the title screen; resolves once the level runs. */
export async function startGame(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  await expect.poll(async () => (await title(page))?.ready, { timeout: 15_000 }).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => sceneKey(page), { timeout: 15_000 }).toBe('Level');
}
