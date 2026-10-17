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
  await expect.poll(async () => (await level(page)).timeMs - fromMs).toBeGreaterThanOrEqual(ms);
  return level(page);
}
