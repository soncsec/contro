import type { Page } from '@playwright/test';

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
