import { expect, test, type Page } from '@playwright/test';
import { level, nextSection, startGame, waitGameTime, watchPage } from './watch';

async function openLevel(page: Page): Promise<void> {
  await startGame(page);
}

test('the HUD shows the level and section, with a banner when it starts', async ({ page }) => {
  const watched = watchPage(page);
  await openLevel(page);
  const start = await level(page);
  expect(start.label).toBe('1-1');
  expect(start.bannerVisible).toBe(true);
  // 1.8 s on screen plus a 0.4 s fade.
  const later = await waitGameTime(page, start.timeMs, 2500);
  expect(later.bannerVisible).toBe(false);
  expect(later.label).toBe('1-1');
  expect(watched.errors).toEqual([]);
});

test('the next section shows 1-2 and its own banner', async ({ page }) => {
  await openLevel(page);
  await nextSection(page);
  const room2 = await level(page);
  expect(room2.level).toBe('corridor-test-2');
  expect(room2.label).toBe('1-2');
  expect(room2.bannerVisible).toBe(true);
});
