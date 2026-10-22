import Phaser from 'phaser';
import {
  KeyLatch,
  boundKeys,
  phaserKeyName,
  type ActionFrame,
  type Bindings,
} from '../logic/input';

/**
 * Keys held down right now, game-wide. Each scene makes its own KeyboardInput, which only hears
 * keys pressed after it starts; this lets a new scene know that fire (or right) is already held,
 * so holding fire through a stage's exit keeps firing in the next stage (M7.2, owner request).
 */
const heldNow = new Set<string>();
let tracking = false;

function trackHeldKeys(): void {
  if (tracking) return;
  tracking = true;
  window.addEventListener('keydown', (e) => heldNow.add(e.code));
  window.addEventListener('keyup', (e) => heldNow.delete(e.code));
  window.addEventListener('blur', () => heldNow.clear());
}

/** Feeds Phaser keyboard events into a KeyLatch (all the rules live there, unit tested). */
export class KeyboardInput {
  private readonly latch = new KeyLatch();

  constructor(
    scene: Phaser.Scene,
    private readonly bindings: Bindings,
  ) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('keyboard input is not available');
    // Stop arrows and Space from also scrolling the page.
    keyboard.addCapture(boundKeys(bindings).map(phaserKeyName).join(','));
    trackHeldKeys();
    this.holdHeldKeys();
    const down = (e: KeyboardEvent): void => this.latch.keyDown(e.code, e.repeat);
    const up = (e: KeyboardEvent): void => this.latch.keyUp(e.code);
    const clear = (): void => {
      heldNow.clear();
      this.latch.clear();
    };
    keyboard.on('keydown', down);
    keyboard.on('keyup', up);
    scene.game.events.on(Phaser.Core.Events.BLUR, clear);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', down);
      keyboard.off('keyup', up);
      scene.game.events.off(Phaser.Core.Events.BLUR, clear);
    });
  }

  /**
   * Start again from the keys held right now (e.g. after the pause menu): keys released while
   * this scene was paused are forgotten, and keys still down count as held, not new presses.
   */
  clear(): void {
    this.latch.clear();
    this.holdHeldKeys();
  }

  /** Keys already down count as held, never as new presses (so they can't skip a card). */
  private holdHeldKeys(): void {
    for (const code of heldNow) this.latch.keyDown(code, true);
  }

  /** The actions for this frame. Call once per frame. */
  frame(): ActionFrame {
    return this.latch.frame(this.bindings);
  }
}
