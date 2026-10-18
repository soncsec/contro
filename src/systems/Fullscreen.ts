/**
 * Fullscreen on the F key (M2.10). Browsers only allow fullscreen from inside a real key or
 * click event handler, and Phaser handles keys later in its game loop, so this listens to the
 * native keydown event directly. The game's resize handling picks a new whole-number zoom.
 */
export const FULLSCREEN_KEY = 'KeyF';

export function installFullscreenKey(target: HTMLElement): void {
  window.addEventListener('keydown', (e) => {
    if (e.code !== FULLSCREEN_KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    toggleFullscreen(target);
  });
}

export function toggleFullscreen(target: HTMLElement): void {
  // Some browsers or embeds refuse fullscreen; the game simply stays windowed.
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  } else {
    target.requestFullscreen?.().catch(() => undefined);
  }
}
